import {
  AudioModule,
  RecordingPresets,
  setAudioModeAsync,
  useAudioRecorder,
  useAudioRecorderState,
} from 'expo-audio';
import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';

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

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startTimeRef = useRef<number>(0);

  // Dọn dẹp timer khi unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      try {
        if (recorder.isRecording) {
          recorder.stop();
        }
        setAudioModeAsync({ allowsRecording: false }).catch(() => {});
      } catch (e) {
        console.warn('[Recorder] Cleanup warning:', e);
      }
    };
  }, [recorder]);

  // Đồng bộ: nếu recorder vừa dừng từ native và có uri
  useEffect(() => {
    if (!recorderState.isRecording && recorder.uri && status === 'recording') {
      onAudioUriChange(recorder.uri);
      onStatusChange('recorded');
    }
  }, [recorderState.isRecording, recorder.uri, status, onAudioUriChange, onStatusChange]);

  // 1. BẮT ĐẦU GHI ÂM
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
          'Vui lòng cấp quyền Microphone trong cài đặt để sử dụng tính năng ghi âm cấp cứu.'
        );
        onStatusChange('error');
        return;
      }

      // Kích hoạt ghi âm
      await setAudioModeAsync({
        allowsRecording: true,
        playsInSilentMode: true,
      });

      // Nếu đang chạy dở thì dừng phiên cũ
      if (recorderState.isRecording || recorder.isRecording) {
        try {
          await recorder.stop();
        } catch {}
      }

      // Chuẩn bị ghi âm an toàn
      try {
        await recorder.prepareToRecordAsync();
      } catch (prepErr: any) {
        console.log('[Recorder] prepareToRecordAsync ready:', prepErr?.message);
      }

      // Khởi động đồng hồ đếm thời gian thực
      if (timerRef.current) clearInterval(timerRef.current);
      startTimeRef.current = Date.now();
      timerRef.current = setInterval(() => {
        const elapsed = Date.now() - startTimeRef.current;
        onDurationChange(elapsed);
      }, 100);

      recorder.record();
      onStatusChange('recording');
    } catch (e: any) {
      console.error('[Recorder] start error:', e?.message || e);
      Alert.alert('Không thể ghi âm', e?.message || 'Vui lòng kiểm tra quyền microphone và thử lại');
      onStatusChange('error');
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      try {
        await setAudioModeAsync({ allowsRecording: false });
      } catch {}
    }
  };

  // 2. DỪNG GHI ÂM (Dừng đồng hồ + Nhả quyền Mic ngay lập tức)
  const stopRecording = async () => {
    if (disabled) return;

    // Dừng đồng hồ đếm ngay lập tức
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    try {
      if (recorderState.isRecording || recorder.isRecording || status === 'recording') {
        try {
          await recorder.stop();
        } catch (stopErr) {
          console.warn('[Recorder] stop inner warning:', stopErr);
        }
      }

      // Tắt microphone ngay lập tức trên hệ điều hành
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

  // 3. XOÁ & LÀM LẠI
  const resetRecording = async () => {
    if (disabled) return;
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
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
      {/* Top Header: Trạng thái & Thời gian đếm */}
      <View style={styles.infoRow}>
        <View style={[styles.statusPill, getStatusPillStyle(status)]}>
          <View style={[styles.statusDot, { backgroundColor: getStatusDotColor(status) }]} />
          <Text style={[styles.statusText, getStatusTextStyle(status)]}>
            {getStatusLabel(status)}
          </Text>
        </View>
        <View style={styles.timerBadge}>
          <Ionicons name="timer-outline" size={14} color="#94A3B8" />
          <Text style={styles.durationText}>{mm}:{ss}</Text>
        </View>
      </View>

      {/* Banner Trạng Thái Chi Tiết */}
      {isCurrentlyRecording && (
        <View style={styles.recordingBar}>
          <View style={styles.recordingDot} />
          <Text style={styles.recordingHint}>
            Đang thu âm... Nhấn nút "DỪNG GHI ÂM" khi nói xong
          </Text>
        </View>
      )}

      {status === 'recorded' && (
        <View style={styles.recordedHint}>
          <Ionicons name="checkmark-circle" size={16} color="#10B981" />
          <Text style={styles.recordedHintText}>
            Đã ghi xong ({mm}:{ss}). Bạn có thể nhấn "GỬI GHI ÂM CẤP CỨU" hoặc ghi âm lại
          </Text>
        </View>
      )}

      {status === 'error' && (
        <View style={styles.errorHint}>
          <Ionicons name="alert-circle" size={16} color="#EF4444" />
          <Text style={styles.errorHintText}>
            Lỗi ghi âm. Vui lòng kiểm tra quyền microphone và thử lại.
          </Text>
        </View>
      )}

      {/* Action Row: Các nút điều khiển */}
      <View style={styles.actionRow}>
        {status === 'preparing' ? (
          <View style={[styles.recordBtn, styles.recordBtnDisabled]}>
            <ActivityIndicator color="#FFF" size="small" />
            <Text style={styles.recordBtnText}>Đang chuẩn bị...</Text>
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
            <Ionicons name="mic" size={18} color="#FFF" />
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
            <Ionicons name="trash-outline" size={16} color="#94A3B8" />
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
    case 'preparing': return 'Đang chuẩn bị...';
    case 'recording': return 'Đang ghi âm';
    case 'recorded': return 'Đã ghi xong';
    case 'error': return 'Lỗi ghi âm';
  }
}

function getStatusDotColor(s: RecorderStatus) {
  switch (s) {
    case 'recording': return '#EF4444';
    case 'recorded': return '#10B981';
    case 'error': return '#EF4444';
    case 'preparing': return '#F59E0B';
    default: return '#38BDF8';
  }
}

function getStatusPillStyle(s: RecorderStatus) {
  switch (s) {
    case 'recording': return { backgroundColor: 'rgba(239, 68, 68, 0.15)', borderColor: 'rgba(239, 68, 68, 0.3)' };
    case 'recorded': return { backgroundColor: 'rgba(16, 185, 129, 0.15)', borderColor: 'rgba(16, 185, 129, 0.3)' };
    case 'error': return { backgroundColor: 'rgba(239, 68, 68, 0.15)', borderColor: 'rgba(239, 68, 68, 0.3)' };
    case 'preparing': return { backgroundColor: 'rgba(245, 158, 11, 0.15)', borderColor: 'rgba(245, 158, 11, 0.3)' };
    default: return { backgroundColor: 'rgba(56, 189, 248, 0.15)', borderColor: 'rgba(56, 189, 248, 0.3)' };
  }
}

function getStatusTextStyle(s: RecorderStatus) {
  switch (s) {
    case 'recording': return { color: '#F87171' };
    case 'recorded': return { color: '#34D399' };
    case 'error': return { color: '#F87171' };
    case 'preparing': return { color: '#FBBF24' };
    default: return { color: '#38BDF8' };
  }
}

const styles = StyleSheet.create({
  wrapper: {
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    gap: 12,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    borderWidth: 1,
    gap: 6,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  timerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(30, 41, 59, 0.6)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
  },
  durationText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#F8FAFC',
    letterSpacing: 0.5,
  },
  recordingBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
    padding: 10,
    borderRadius: 10,
    gap: 8,
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.3)',
  },
  recordingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#EF4444',
  },
  recordingHint: {
    fontSize: 11,
    color: '#FCA5A5',
    fontWeight: '700',
    flex: 1,
  },
  recordedHint: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
    padding: 10,
    borderRadius: 10,
    gap: 6,
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.3)',
  },
  recordedHintText: {
    fontSize: 11,
    color: '#6EE7B7',
    fontWeight: '700',
    flex: 1,
  },
  errorHint: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
    padding: 10,
    borderRadius: 10,
    gap: 6,
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.3)',
  },
  errorHintText: {
    fontSize: 11,
    color: '#FCA5A5',
    fontWeight: '700',
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
    paddingVertical: 12,
    borderRadius: 12,
    gap: 8,
  },
  recordBtnStart: {
    backgroundColor: '#EF4444',
  },
  recordBtnStop: {
    backgroundColor: '#B91C1C',
  },
  recordBtnDisabled: {
    backgroundColor: '#475467',
  },
  recordBtnText: {
    color: '#FFF',
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  stopSquare: {
    width: 12,
    height: 12,
    backgroundColor: '#FFF',
    borderRadius: 2,
  },
  secondaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 12,
    backgroundColor: 'rgba(30, 41, 59, 0.8)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    gap: 6,
  },
  secondaryBtnText: {
    color: '#94A3B8',
    fontSize: 12,
    fontWeight: '700',
  },
});
