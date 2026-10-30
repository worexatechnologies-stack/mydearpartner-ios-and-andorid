import json
import logging
import os
import re
import urllib.error
import urllib.parse
import urllib.request
from typing import Optional

logger = logging.getLogger(__name__)

# In-memory outbox for testing and local development
MOCK_SMS_OUTBOX = []


class SmsDeliveryError(Exception):
    """Raised when the SMS provider fails to deliver the message."""
    pass


def mask_phone(phone_number: str) -> str:
    """Mask phone number for safe public display: e.g. '+91 ******3210' or '******3210'."""
    if not phone_number:
        return '******0000'
    cleaned = phone_number.strip()
    digits_only = re.sub(r'\D', '', cleaned)
    
    if len(digits_only) >= 10:
        last4 = digits_only[-4:]
        prefix = '+91 ' if cleaned.startswith('+91') or len(digits_only) > 10 else ''
        return f"{prefix}******{last4}"
    
    if len(cleaned) <= 4:
        return '******'
    return f"******{cleaned[-4:]}"


def send_sms_otp(phone_number: str, otp: str, user=None) -> bool:
    """
    Deliver SMS OTP to the given phone number via the configured provider.
    Supported providers:
    - renflair (Default for India / MyDearPartner)
    - twilio
    - msg91
    - mock / console (for test runs and local development without credentials)
    """
    clean_digits = re.sub(r'\D', '', phone_number)
    ten_digit = clean_digits[-10:] if len(clean_digits) >= 10 else clean_digits

    # Detect test environment
    is_testing = os.environ.get('TESTING', 'false').lower() == 'true' or 'test' in os.environ.get('DJANGO_SETTINGS_MODULE', '')
    provider = os.environ.get('SMS_PROVIDER', 'renflair').lower()
    renflair_key = os.environ.get('RENFLAIR_API_KEY', '').strip()

    # Fallback to mock in tests or when explicitly set
    if is_testing or provider in ('mock', 'console'):
        MOCK_SMS_OUTBOX.append({
            'phone': phone_number,
            'ten_digit': ten_digit,
            'otp': otp,
            'user_id': str(user.pk) if user else None,
        })
        logger.info(f"[SMS MOCK] Simulated OTP sent to {mask_phone(phone_number)}")
        return True

    if provider == 'renflair' and not renflair_key:
        raise SmsDeliveryError('SMS provider is not configured.')

    # 1. Renflair SMS Provider
    if provider == 'renflair' or renflair_key:
        sender_id = os.environ.get('RENFLAIR_SENDER_ID', 'MDPTRN')
        dlt_template_id = os.environ.get('RENFLAIR_DLT_TE_ID', '')
        # Approved DLT Template Format
        message = f"Your MyDearPartner verification code is {otp}. Valid for 5 minutes. Please do not share this OTP."
        
        endpoint = os.environ.get('RENFLAIR_API_URL', 'https://sms.renflair.in/V2/http-api.php')
        params = {
            'apikey': renflair_key,
            'senderid': sender_id,
            'number': f"91{ten_digit}",
            'message': message,
            'format': 'json',
        }
        if dlt_template_id:
            params['template_id'] = dlt_template_id

        try:
            query_string = urllib.parse.urlencode(params)
            req = urllib.request.Request(
                f"{endpoint}?{query_string}",
                headers={'User-Agent': 'MyDearPartner-Backend/1.0'},
                method='GET',
            )
            with urllib.request.urlopen(req, timeout=10) as response:
                status_code = response.getcode()
                raw_response = response.read().decode('utf-8')
                if status_code != 200:
                    logger.warning(f"Renflair SMS non-200 status {status_code} for {mask_phone(phone_number)}")
                    raise SmsDeliveryError("SMS provider responded with an error.")
                try:
                    res_json = json.loads(raw_response)
                    if res_json.get('status') == 'error':
                        logger.warning(f"Renflair SMS API rejected request: {res_json.get('message', 'unknown')}")
                        raise SmsDeliveryError("SMS delivery was rejected by the gateway.")
                except json.JSONDecodeError:
                    pass  # Non-JSON 200 response accepted
                logger.info(f"SMS successfully dispatched via Renflair to {mask_phone(phone_number)}")
                return True
        except urllib.error.URLError as e:
            logger.error(f"Renflair SMS network failure for {mask_phone(phone_number)}: {e}")
            raise SmsDeliveryError("Could not connect to the SMS gateway. Please try again.")
        except Exception as e:
            if isinstance(e, SmsDeliveryError):
                raise
            logger.error(f"Unexpected SMS gateway error for {mask_phone(phone_number)}")
            raise SmsDeliveryError("SMS delivery failed. Please try again later.")

    # 2. Twilio SMS Provider
    if provider == 'twilio' or os.environ.get('TWILIO_ACCOUNT_SID'):
        account_sid = os.environ.get('TWILIO_ACCOUNT_SID')
        auth_token = os.environ.get('TWILIO_AUTH_TOKEN')
        from_number = os.environ.get('TWILIO_FROM_NUMBER')
        to_number = f"+91{ten_digit}"
        message = f"Your MyDearPartner verification code is: {otp}"

        endpoint = f"https://api.twilio.com/2010-04-01/Accounts/{account_sid}/Messages.json"
        data = urllib.parse.urlencode({
            'From': from_number,
            'To': to_number,
            'Body': message,
        }).encode('utf-8')

        import base64
        creds = base64.b64encode(f"{account_sid}:{auth_token}".encode('utf-8')).decode('utf-8')
        req = urllib.request.Request(
            endpoint,
            data=data,
            headers={
                'Authorization': f"Basic {creds}",
                'User-Agent': 'MyDearPartner-Backend/1.0',
            },
            method='POST',
        )
        try:
            with urllib.request.urlopen(req, timeout=10) as response:
                if response.getcode() not in (200, 201):
                    raise SmsDeliveryError("Twilio SMS provider returned non-success code.")
                logger.info(f"SMS successfully dispatched via Twilio to {mask_phone(phone_number)}")
                return True
        except Exception as e:
            logger.error(f"Twilio SMS failure for {mask_phone(phone_number)}: {e}")
            raise SmsDeliveryError("Could not deliver SMS via Twilio.")

    # 3. MSG91 SMS Provider
    if provider == 'msg91' or os.environ.get('MSG91_AUTH_KEY'):
        auth_key = os.environ.get('MSG91_AUTH_KEY')
        template_id = os.environ.get('MSG91_TEMPLATE_ID', '')
        endpoint = "https://control.msg91.com/api/v5/otp"
        headers = {
            'authkey': auth_key,
            'content-type': 'application/json',
            'User-Agent': 'MyDearPartner-Backend/1.0',
        }
        body = json.dumps({
            'template_id': template_id,
            'mobile': f"91{ten_digit}",
            'otp': otp,
        }).encode('utf-8')
        req = urllib.request.Request(endpoint, data=body, headers=headers, method='POST')
        try:
            with urllib.request.urlopen(req, timeout=10) as response:
                if response.getcode() != 200:
                    raise SmsDeliveryError("MSG91 returned an error.")
                logger.info(f"SMS successfully dispatched via MSG91 to {mask_phone(phone_number)}")
                return True
        except Exception as e:
            logger.error(f"MSG91 SMS failure for {mask_phone(phone_number)}: {e}")
            raise SmsDeliveryError("Could not deliver SMS via MSG91.")

    raise SmsDeliveryError('SMS provider is not configured.')
