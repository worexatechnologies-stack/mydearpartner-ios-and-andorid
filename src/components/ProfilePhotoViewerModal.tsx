import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from 'react-native';
import { launchImageLibrary } from 'react-native-image-picker';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/Ionicons';
import * as ProfileService from '../api/profileService';
import { useAuth } from '../context/AuthContext';
import { colors, shadow } from '../theme/theme';
import { COMPATIBLE_IMAGE_PICKER_OPTIONS } from '../utils/profilePhotos';
import AuthImage from './AuthImage';

interface ProfilePhotoViewerModalProps {
  visible: boolean;
  onClose: () => void;
  photoUri?: string | null;
  photoId?: string | null;
  title?: string;
  onPhotoUpdated?: (newUri: string) => void;
  onPhotoDeleted?: () => void;
}

export default function ProfilePhotoViewerModal({
  visible,
  onClose,
  photoUri,
  photoId,
  title = 'Profile Photo',
  onPhotoUpdated,
  onPhotoDeleted,
}: ProfilePhotoViewerModalProps) {
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const { currentUser, refreshCurrentUser } = useAuth();
  const [loading, setLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('');

  if (!visible) return null;

  const currentUri = photoUri || currentUser?.profile?.photo || '';

  const handleEditPhoto = async () => {
    if (loading) return;
    try {
      const result = await launchImageLibrary(COMPATIBLE_IMAGE_PICKER_OPTIONS);
      if (result.didCancel || !result.assets || result.assets.length === 0) {
        return;
      }
      const asset = result.assets[0];
      if (!asset.uri) return;

      setLoading(true);
      setLoadingMessage('Uploading new photo…');

      const fileName = asset.fileName || 'profile_photo.jpg';
      const mimeType = asset.type || 'image/jpeg';
      const uploaded = await ProfileService.uploadPhoto(asset.uri, fileName, mimeType);

      if (refreshCurrentUser) {
        await refreshCurrentUser();
      }

      onPhotoUpdated?.(uploaded.uri);
      Alert.alert('Success', 'Profile photo updated successfully.');
      onClose();
    } catch (err: any) {
      Alert.alert('Upload Failed', err?.message || 'Could not update photo. Please try again.');
    } finally {
      setLoading(false);
      setLoadingMessage('');
    }
  };

  const handleDeletePhoto = () => {
    if (loading) return;

    Alert.alert(
      'Delete Photo',
      'Are you sure you want to delete this profile photo?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            setLoading(true);
            setLoadingMessage('Removing photo…');
            try {
              let targetId = photoId;

              // If photoId is not provided, try resolving from currentUser profile photoIds or gallery
              if (!targetId && currentUri) {
                targetId = currentUser?.profile?.photoIds?.[currentUri];
              }

              if (!targetId) {
                // Fetch user's photos from server to match the photo ID
                const gallery = await ProfileService.getMyPhotos();
                const matched = gallery.photos.find(p => p.uri === currentUri);
                if (matched?.id) {
                  targetId = matched.id;
                } else if (gallery.photos.length > 0) {
                  targetId = gallery.photos[0].id;
                }
              }

              if (targetId) {
                await ProfileService.deletePhoto(targetId);
              }

              if (refreshCurrentUser) {
                await refreshCurrentUser();
              }

              onPhotoDeleted?.();
              Alert.alert('Photo Deleted', 'The photo has been removed from your profile.');
              onClose();
            } catch (err: any) {
              Alert.alert('Delete Failed', err?.message || 'Could not remove photo. Please try again.');
            } finally {
              setLoading(false);
              setLoadingMessage('');
            }
          },
        },
      ],
    );
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View style={styles.backdrop}>
        {/* Top App Bar */}
        <View style={[styles.topBar, { paddingTop: Math.max(insets.top, 16) }]}>
          <TouchableOpacity
            style={styles.circleBtn}
            onPress={onClose}
            disabled={loading}
            accessibilityRole="button"
            accessibilityLabel="Close photo viewer"
          >
            <Icon name="close" size={22} color="#FFFFFF" />
          </TouchableOpacity>

          <View style={styles.titleCol}>
            <Text style={styles.titleText}>{title}</Text>
          </View>

          <View style={styles.spacer} />
        </View>

        {/* Main Photo View Area */}
        <View style={styles.photoContainer}>
          {currentUri ? (
            <AuthImage
              source={{ uri: currentUri }}
              style={[
                styles.largePhoto,
                {
                  width: width - 32,
                  height: Math.min(height * 0.6, width * 1.2),
                },
              ]}
              resizeMode="contain"
            />
          ) : (
            <View style={styles.emptyPlaceholder}>
              <Icon name="person" size={80} color="rgba(255,255,255,0.4)" />
              <Text style={styles.emptyText}>No photo available</Text>
            </View>
          )}

          {/* Loading Indicator Overlay */}
          {loading && (
            <View style={styles.loadingOverlay}>
              <ActivityIndicator size="large" color="#FFFFFF" />
              <Text style={styles.loadingText}>{loadingMessage}</Text>
            </View>
          )}
        </View>

        {/* Bottom Actions Bar */}
        <View
          style={[
            styles.bottomBar,
            { paddingBottom: Math.max(insets.bottom, 20) },
          ]}
        >
          <TouchableOpacity
            style={[styles.actionBtn, styles.editBtn]}
            onPress={handleEditPhoto}
            disabled={loading}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel="Change profile photo"
          >
            <Icon name="camera-outline" size={18} color="#FFFFFF" style={styles.btnIcon} />
            <Text style={styles.editBtnText}>Change Photo</Text>
          </TouchableOpacity>

          {Boolean(currentUri) && (
            <TouchableOpacity
              style={[styles.actionBtn, styles.deleteBtn]}
              onPress={handleDeletePhoto}
              disabled={loading}
              activeOpacity={0.8}
              accessibilityRole="button"
              accessibilityLabel="Delete profile photo"
            >
              <Icon name="trash-outline" size={18} color="#EF4444" style={styles.btnIcon} />
              <Text style={styles.deleteBtnText}>Delete</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(10, 10, 15, 0.95)',
    justifyContent: 'space-between',
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 12,
    zIndex: 10,
  },
  circleBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  titleCol: {
    alignItems: 'center',
  },
  titleText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  spacer: {
    width: 40,
  },
  photoContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  largePhoto: {
    borderRadius: 16,
    overflow: 'hidden',
  },
  emptyPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    color: 'rgba(255, 255, 255, 0.6)',
    fontSize: 15,
    marginTop: 12,
    fontWeight: '500',
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 16,
  },
  loadingText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
    marginTop: 12,
  },
  bottomBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    paddingHorizontal: 20,
    paddingTop: 16,
    backgroundColor: 'rgba(20, 20, 28, 0.85)',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.1)',
  },
  actionBtn: {
    flex: 1,
    maxWidth: 200,
    height: 48,
    borderRadius: 24,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  editBtn: {
    backgroundColor: colors.primary,
    ...shadow.sm,
  },
  editBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  deleteBtn: {
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.4)',
  },
  deleteBtnText: {
    color: '#EF4444',
    fontSize: 15,
    fontWeight: '700',
  },
  btnIcon: {
    marginRight: 6,
  },
});
