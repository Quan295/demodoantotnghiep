import {
  AudioModule,
  RecordingPresets,
  setAudioModeAsync,
  useAudioRecorder,
  useAudioRecorderState,
} from 'expo-audio';
import React, { useEffect, useRef } from 'react';
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
  const isCleaningUp = useRef(false);

  // 1. Đồng bộ thời gian ghi âm liên tục khi đang ghi
  useEffect(() => {
    if (status === 'recording' && recorderState.durationMillis > 0) {
      onDurationChange(recorderState.durationMillis);
    }
  }, [recorderState.durationMillis, status, onDurationChange]);

  // 2. Đồng bộ: nếu recorder vừa dừng và có uri
  useEffect(() => {
    if (!recorderState.isRecording && recorder.uri && status === 'recording') {
      onAudioUriChange(recorder.uri);
      onStatusChange('recorded');
    }
  }, [recorderState.isRecording, recorder.uri, status, onAudioUriChange, onStatusChange]);

  // 3. Cleanup khi unmount hoặc rời màn hình: Nhả microphone và Audio session
  useEffect(() => {
    return () => {
      isCleaningUp.current = true;
      try {
        if (recorder.isRecording) {
          recorder.stop();
        }
        setAudioModeAsync({ allowsRecording: false }).catch(() => {});
      } catch (e) {
        console.warn('[Recorder] Cleanup stop warning:', e);
      }
    };
  }, [recorder]);

  // Bắt đầu ghi âm
  const startRecording = async () => {
    if (disabled) return;
    try {
      onStatusChange('preparing');
      onAudioUriChange(null);
      onDurationChange(0);

      // Xin quyền Microphone
      const permission = await AudioModule.requestRecordingPermissionsAsync();
      if (!permission.granted) {
        Alert.alert(
          'Thiếu quyền Microphone',
          'Bạn cần cấp quyền Microphone để ghi âm tình trạng khẩn cấp.'
        );
        onStatusChange('error');
        return;
      }

      // Kích hoạt chế độ cho phép ghi âm
      await setAudioModeAsync({
        allowsRecording: true,
        playsInSilentMode: true,
      });

      // Nếu đang chạy dở, dừng phiên cũ trước
      if (recorderState.isRecording || recorder.isRecording) {
        try {
          await recorder.stop();
        } catch {}
      }

      // Chuẩn bị ghi âm an toàn
      try {
        await recorder.prepareToRecordAsync();
      } catch (prepErr: any) {
        console.log('[Recorder] prepareToRecordAsync already prepared:', prepErr?.message);
      }

      recorder.record();
      onStatusChange('recording');
    } catch (e: any) {
      console.error('[Recorder] start error:', e?.message || e);
      Alert.alert('Không thể ghi âm', e?.message || 'Vui lòng kiểm tra quyền microphone và thử lại');
      onStatusChange('error');
      try {
        await setAudioModeAsync({ allowsRecording: false });
      } catch {}
    }
  };

  // Dừng ghi âm: ngắt microphone và nhả quyền ghi âm
  const stopRecording = async () => {
    if (disabled) return;
    try {
      if (recorderState.isRecording || recorder.isRecording || status === 'recording') {
        try {
          await recorder.stop();
        } catch (stopErr) {
          console.warn('[Recorder] stop inner warning:', stopErr);
        }
      }

      // Nhả chế độ ghi âm ngay lập tức để hệ thống tắt icon mic trên status bar
      try {
        await setAudioModeAsync({
          allowsRecording: false,
          playsInSilentMode: true,
        });
      } catch (audioModeErr) {
        console.warn('[Recorder] setAudioModeAsync release warning:', audioModeErr);
      }

      const uri = recorder.uri;
      if (uri) {
        onAudioUriChange(uri);
        onStatusChange('recorded');
      } else {
        setTimeout(() => {
          if (recorder.uri) {
            onAudioUriChange(recorder.uri);
          }
          onStatusChange('recorded');
        }, 150);
      }
    } catch (e: any) {
      console.error('[Recorder] stop error:', e?.message || e);
      if (recorder.uri) {
        onAudioUriChange(recorder.uri);
        onStatusChange('recorded');
      } else {
        onStatusChange('recorded');
      }
      try {
        await setAudioModeAsync({ allowsRecording: false });
      } catch {}
    }
  };

  // Hủy / Làm lại
  const resetRecording = async () => {
    if (disabled) return;
    try {
      if (recorderState.isRecording || recorder.isRecording) {
        await recorder.stop();
      }
      await setAudioModeAsync({ allowsRecording: false });
    } catch {}
    onAudioUriChange(null);
    onDurationChange(0);
    onStatusChange('idle');
  };

  const isCurrentlyRecording = status === 'recording' || recorderState.isRecording;

  const seconds = Math.floor(Math.max(0, durationMillis) / 1000);
  const mm = Math.floor(seconds / 60).toString().padStart(2, '0');
  const ss = (seconds % 60).toString().padStart(2, '0');

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
        </View>
      </View>

      {isCurrentlyRecording && (
        <View style={styles.recordingBar}>
          <View style={styles.recordingDot} />
          <Text style={styles.recordingHint}>Đang ghi âm... Nhấn nút "Dừng ghi âm" khi nói xong</Text>
        </View>
      )}

      {status === 'recorded' && audioUri && (
        <View style={styles.recordedHint}>
          <Ionicons name="checkmark-circle" size={16} color="#10b981" />
          <Text style={styles.recordedHintText}>Đã ghi xong ({mm}:{ss}). Bạn có thể gửi ngay hoặc ghi lại</Text>
        </View>
      )}

      {status === 'error' && (
        <View style={styles.recordedHint}>
          <Ionicons name="alert-circle" size={16} color="#ef4444" />
          <Text style={[styles.recordedHintText, { color: '#ef4444' }]}>
            Lỗi ghi âm. Vui lòng kiểm tra quyền microphone và thử lại.
          </Text>
        </View>
      )}

      <View style={styles.actionRow}>
        {status === 'preparing' ? (
          <View style={[styles.recordBtn, styles.recordBtnDisabled]}>
            <ActivityIndicator color="#FFF" />
            <Text style={styles.recordBtnText}>Chuẩn bị...</Text>
          </View>
        ) : isCurrentlyRecording ? (
          <TouchableOpacity
            style={[styles.recordBtn, styles.recordBtnStop]}
            onPress={stopRecording}
            disabled={!!disabled}
            activeOpacity={0.85}
          >
            <View style={styles.stopSquare} />
            <Text style={styles.recordBtnText}>DỪNG GHI ÂM</Text>
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
              {status === 'recorded' || audioUri ? 'Ghi âm lại' : 'Bắt đầu ghi âm'}
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
    case 'preparing': return 'Chuẩn bị...';
    case 'recording': return 'Đang ghi âm';
    case 'recorded': return 'Đã ghi xong';
    case 'error': return 'Lỗi ghi âm';
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
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '700',
  },
  metaCol: {
    alignItems: 'flex-end',
  },
  durationText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1f2937',
  },
  recordingBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fef2f2',
    padding: 10,
    borderRadius: 10,
    gap: 8,
    borderWidth: 1,
    borderColor: '#fecaca',
  },
  recordingDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#ef4444',
  },
  recordingHint: {
    fontSize: 12,
    color: '#991b1b',
    fontWeight: '600',
    flex: 1,
  },
  recordedHint: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f0fdf4',
    padding: 10,
    borderRadius: 10,
    gap: 6,
    borderWidth: 1,
    borderColor: '#bbf7d0',
  },
  recordedHintText: {
    fontSize: 12,
    color: '#166534',
    fontWeight: '600',
    flex: 1,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  recordBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 12,
    gap: 8,
  },
  recordBtnStart: {
    backgroundColor: '#ef4444',
  },
  recordBtnStop: {
    backgroundColor: '#dc2626',
  },
  recordBtnDisabled: {
    backgroundColor: '#9ca3af',
  },
  recordBtnText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '800',
  },
  stopSquare: {
    width: 14,
    height: 14,
    backgroundColor: '#FFF',
    borderRadius: 3,
  },
  secondaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 12,
    backgroundColor: '#f3f4f6',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    gap: 6,
  },
  secondaryBtnText: {
    color: '#4b5563',
    fontSize: 13,
    fontWeight: '600',
  },
});
