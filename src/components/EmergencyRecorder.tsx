import {
  AudioModule,
  RecordingPresets,
  setAudioModeAsync,
  useAudioRecorder,
  useAudioRecorderState,
} from 'expo-audio';
import { useEffect, useRef } from 'react';
import { ActivityIndicator, Alert, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export type RecorderStatus = 'idle' | 'preparing' | 'recording' | 'recorded' | 'error';

export interface EmergencyRecorderProps {
  status: RecorderStatus;
  onStatusChange: (status: RecorderStatus) => void;
  audioUri: string | null;
  onAudioUriChange: (uri: string | null) => void;
  durationMillis: number;
  onDurationChange: (ms: number) => void;
  disabled?: boolean;
}

export function EmergencyRecorder({
  status,
  onStatusChange,
  audioUri,
  onAudioUriChange,
  durationMillis,
  onDurationChange,
  disabled,
}: EmergencyRecorderProps) {
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const recorderState = useAudioRecorderState(recorder);
  const permissionRequested = useRef(false);

  // Đồng bộ duration từ recorder state lên parent mỗi khi thay đổi
  useEffect(() => {
    if (recorderState.durationMillis !== durationMillis) {
      onDurationChange(recorderState.durationMillis);
    }
  }, [recorderState.durationMillis, durationMillis, onDurationChange]);

  // Đồng bộ: nếu recorder vừa dừng và có uri → đẩy lên parent (đánh dấu RECORDED)
  useEffect(() => {
    if (!recorderState.isRecording && recorder.uri && status === 'recording') {
      onAudioUriChange(recorder.uri);
      onStatusChange('recorded');
    }
  }, [recorderState.isRecording, recorder.uri, status, onAudioUriChange, onStatusChange]);

  // Mở app → yêu cầu quyền mic + set audio mode
  useEffect(() => {
    if (permissionRequested.current) return;
    permissionRequested.current = true;
    const prepare = async () => {
      try {
        const permission = await AudioModule.requestRecordingPermissionsAsync();
        if (!permission.granted) {
          Alert.alert(
            'Thiếu quyền Microphone',
            'Bạn cần cấp quyền ghi âm để sử dụng tính năng gọi cấp cứu bằng giọng nói.'
          );
          onStatusChange('error');
          return;
        }
        await setAudioModeAsync({
          allowsRecording: true,
          playsInSilentMode: true,
        });
      } catch (e: any) {
        console.error('[Recorder] prepare error:', e?.message || e);
        // Web/nguồn khác không hỗ trợ → tiếp tục, báo lỗi khi người dùng nhấn ghi âm
      }
    };
    prepare();
  }, [onStatusChange]);

  const startRecording = async () => {
    if (disabled) return;
    try {
      onStatusChange('preparing');
      onAudioUriChange(null);
      onDurationChange(0);
      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
      await recorder.prepareToRecordAsync();
      recorder.record();
      onStatusChange('recording');
    } catch (e: any) {
      console.error('[Recorder] start error:', e?.message || e);
      Alert.alert('Không thể ghi âm', e?.message || 'Vui lòng kiểm tra quyền microphone');
      onStatusChange('error');
    }
  };

  const stopRecording = async () => {
    if (disabled) return;
    try {
      await recorder.stop();
      const uri = recorder.uri;
      if (!uri) {
        throw new Error('Không tạo được file ghi âm');
      }
      onAudioUriChange(uri);
      onStatusChange('recorded');
    } catch (e: any) {
      console.error('[Recorder] stop error:', e?.message || e);
      Alert.alert('Lỗi dừng ghi âm', e?.message || 'Vui lòng thử lại');
      onStatusChange('error');
    }
  };

  const resetRecording = () => {
    if (disabled) return;
    onAudioUriChange(null);
    onDurationChange(0);
    onStatusChange('idle');
  };

  const seconds = Math.floor(Math.max(0, durationMillis) / 1000);
  const mm = Math.floor(seconds / 60).toString().padStart(2, '0');
  const ss = (seconds % 60).toString().padStart(2, '0');
  const sizeMB = (recorderState.sizeBytes ?? 0) / (1024 * 1024);

  return (
    <View style={styles.wrapper}>
      <View style={styles.infoRow}>
        <View style={[styles.statusPill, getStatusPillStyle(status)]}>
          <Text style={[styles.statusText, getStatusTextStyle(status)]}>
            {getStatusLabel(status)}
          </Text>
        </View>
        <View style={styles.metaCol}>
          <Text style={styles.durationText}>
            <Ionicons name="timer-outline" size={14} color="#6b7280" /> {mm}:{ss}
          </Text>
          {recorderState.sizeBytes > 0 && status === 'recorded' && (
            <Text style={styles.sizeText}>{sizeMB.toFixed(2)} MB</Text>
          )}
        </View>
      </View>

      {status === 'recording' && (
        <View style={styles.recordingBar}>
          <View style={styles.recordingDot} />
          <Text style={styles.recordingHint}>Đang ghi âm... nhấn Dừng để kết thúc</Text>
        </View>
      )}

      {status === 'recorded' && audioUri && (
        <View style={styles.recordedHint}>
          <Ionicons name="checkmark-circle" size={16} color="#10b981" />
          <Text style={styles.recordedHintText}>Đã ghi xong. Nhấn Gửi để phân tích AI</Text>
        </View>
      )}

      {status === 'error' && (
        <View style={styles.recordedHint}>
          <Ionicons name="alert-circle" size={16} color="#ef4444" />
          <Text style={[styles.recordedHintText, { color: '#ef4444' }]}>
            Lỗi ghi âm. Hãy kiểm tra quyền microphone.
          </Text>
        </View>
      )}

      <View style={styles.actionRow}>
        {status === 'preparing' ? (
          <View style={[styles.recordBtn, styles.recordBtnDisabled]}>
            <ActivityIndicator color="#FFF" />
            <Text style={styles.recordBtnText}>Chuẩn bị...</Text>
          </View>
        ) : status === 'recording' ? (
          <TouchableOpacity
            style={[styles.recordBtn, styles.recordBtnStop]}
            onPress={stopRecording}
            disabled={!!disabled}
            activeOpacity={0.85}
          >
            <View style={styles.stopSquare} />
            <Text style={styles.recordBtnText}>Dừng</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={[styles.recordBtn, styles.recordBtnStart, disabled && styles.recordBtnDisabled]}
            onPress={startRecording}
            disabled={!!disabled}
            activeOpacity={0.85}
          >
            <Ionicons name="mic" size={20} color="#FFF" />
            <Text style={styles.recordBtnText}>
              {status === 'recorded' || audioUri ? 'Ghi lại' : 'Bắt đầu ghi âm'}
            </Text>
          </TouchableOpacity>
        )}

        {(status === 'recorded' || status === 'error') && (
          <TouchableOpacity
            style={[styles.secondaryBtn, disabled && styles.recordBtnDisabled]}
            onPress={resetRecording}
            disabled={!!disabled}
            activeOpacity={0.85}
          >
            <Ionicons name="refresh-outline" size={18} color="#4b5563" />
            <Text style={styles.secondaryBtnText}>Xoá &amp; làm lại</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

function getStatusLabel(s: RecorderStatus) {
  switch (s) {
    case 'idle': return 'Sẵn sàng';
    case 'preparing': return 'Chuẩn bị';
    case 'recording': return 'Đang ghi';
    case 'recorded': return 'Đã ghi';
    case 'error': return 'Lỗi';
  }
}
function getStatusPillStyle(s: RecorderStatus) {
  switch (s) {
    case 'recording': return { backgroundColor: '#fee2e2' };
    case 'recorded': return { backgroundColor: '#d1fae5' };
    case 'error': return { backgroundColor: '#fee2e2' };
    case 'preparing': return { backgroundColor: '#fef9c3' };
    default: return { backgroundColor: '#e0f2fe' };
  }
}
function getStatusTextStyle(s: RecorderStatus) {
  switch (s) {
    case 'recording': return { color: '#991b1b' };
    case 'recorded': return { color: '#065f46' };
    case 'error': return { color: '#991b1b' };
    case 'preparing': return { color: '#854d0e' };
    default: return { color: '#075985' };
  }
}

const styles = StyleSheet.create({
  wrapper: {
    backgroundColor: '#FFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
    gap: 12,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  statusPill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '700',
  },
  metaCol: {
    alignItems: 'flex-end',
  },
  durationText: {
    fontSize: 13,
    color: '#374151',
    fontWeight: '600',
  },
  sizeText: {
    fontSize: 11,
    color: '#6b7280',
    marginTop: 2,
  },
  recordingBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: '#fef2f2',
    borderRadius: 10,
  },
  recordingDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#ef4444',
  },
  recordingHint: {
    color: '#991b1b',
    fontSize: 13,
    fontWeight: '500',
  },
  recordedHint: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: '#f0fdf4',
    borderRadius: 10,
  },
  recordedHintText: {
    color: '#065f46',
    fontSize: 13,
    fontWeight: '500',
  },
  actionRow: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'center',
  },
  recordBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  recordBtnStart: {
    backgroundColor: '#10b981',
    shadowColor: '#10b981',
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 3,
  },
  recordBtnStop: {
    backgroundColor: '#ef4444',
    shadowColor: '#ef4444',
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 3,
  },
  recordBtnDisabled: {
    opacity: 0.5,
  },
  recordBtnText: {
    color: '#FFF',
    fontSize: 15,
    fontWeight: '700',
  },
  stopSquare: {
    width: 16,
    height: 16,
    borderRadius: 3,
    backgroundColor: '#FFF',
  },
  secondaryBtn: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#f3f4f6',
  },
  secondaryBtnText: {
    color: '#374151',
    fontSize: 14,
    fontWeight: '600',
  },
});
