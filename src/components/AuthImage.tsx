import BufferingIndicator from './BufferingIndicator';
import React,{ useState } from 'react';
import { Image,ImageProps,Pressable,StyleSheet,Text,View } from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { get } from '../api/apiClient';
import { colors } from '../theme/theme';
import { authenticatedImageSource } from '../utils/imageSource';
import { currentAccessToken } from '../utils/keychain';

interface AuthImageProps extends Omit<ImageProps, 'source'> {
  source: ImageProps['source'] | { uri?: string };
  fallbackLabel?: string;
  showLoading?: boolean;
}

export default function AuthImage({
  source,
  onError,
  onLoadEnd,
  fallbackLabel,
  showLoading = false,
  ...props
}: AuthImageProps) {
  const uri =
    source && typeof source === 'object' && 'uri' in source
      ? source.uri
      : undefined;
  const [failedUri, setFailedUri] = useState<string>();
  const [loadedUri, setLoadedUri] = useState<string>();
  const [retrying, setRetrying] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const missing =
    !source || (typeof source === 'object' && !Array.isArray(source) && !uri);
  if (missing || (uri !== undefined && uri === failedUri)) {
    return (
      <View
        accessibilityLabel={
          props.accessibilityLabel ?? 'Profile photo unavailable'
        }
        style={[styles.fallback, props.style]}
      >
        <Icon name="person-outline" size={28} color={colors.textTertiary} />
        {fallbackLabel ? <Text style={styles.fallbackLabel}>{fallbackLabel}</Text> : null}
        {!missing && showLoading ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Retry profile photo"
            disabled={retrying}
            onPress={async () => {
              setRetrying(true);
              try {
                // A regular authenticated request refreshes an expired session.
                if (authenticatedImageSource({ uri }, currentAccessToken).headers?.Authorization) {
                  await get('/auth/me/');
                }
                setFailedUri(undefined);
                setLoadedUri(undefined);
                setAttempt(value => value + 1);
              } catch {
                // Keep the retry control available when the network is offline.
              } finally {
                setRetrying(false);
              }
            }}
          >
            <Text style={styles.retry}>{retrying ? 'Retrying…' : 'Retry photo'}</Text>
          </Pressable>
        ) : null}
      </View>
    );
  }
  const image = (
    <Image
      key={`${uri ?? 'local'}:${attempt}`}
      {...props}
      style={showLoading ? StyleSheet.absoluteFill : props.style}
      source={
        uri
          ? authenticatedImageSource(
              source as { uri: string },
              currentAccessToken,
            )
          : (source as ImageProps['source'])
      }
      onError={event => {
        setFailedUri(uri);
        onError?.(event);
      }}
      onLoadEnd={() => {
        setLoadedUri(uri);
        onLoadEnd?.();
      }}
    />
  );
  return showLoading ? (
    <View style={props.style}>
      {image}
      {uri && loadedUri !== uri ? (
        <View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.loading]}>
          <BufferingIndicator accessibilityLabel="Loading profile photo" color={colors.primary} />
        </View>
      ) : null}
    </View>
  ) : image;
}

const styles = StyleSheet.create({
  loading: { alignItems: 'center', justifyContent: 'center' },
  fallbackLabel: { marginTop: 8, color: colors.textTertiary, fontSize: 13 },
  retry: { padding: 12, color: colors.primary, fontWeight: '600' },
  fallback: {
    backgroundColor: colors.divider,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
});
