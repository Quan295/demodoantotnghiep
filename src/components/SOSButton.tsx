import React, { useRef, useState, useEffect } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  Animated,
  Platform,
  Vibration,
} from 'react-native';
import { Colors } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

interface SOSButtonProps {
  onTrigger: () => void;
}

export function SOSButton({ onTrigger }: SOSButtonProps) {
  const theme = useTheme();
  const [isPressing, setIsPressing] = useState(false);
  
  // Animation values
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const progressAnim = useRef(new Animated.Value(0)).current;
  const rippleAnim1 = useRef(new Animated.Value(0)).current;
  const rippleAnim2 = useRef(new Animated.Value(0)).current;

  // Pulse/Ripple animations when pressing
  useEffect(() => {
    let rippleLoop: Animated.CompositeAnimation | null = null;

    if (isPressing) {
      // Loop ripple animations
      rippleLoop = Animated.loop(
        Animated.parallel([
          Animated.sequence([
            Animated.timing(rippleAnim1, {
              toValue: 1,
              duration: 1500,
              useNativeDriver: true,
            }),
            Animated.timing(rippleAnim1, {
              toValue: 0,
              duration: 0,
              useNativeDriver: true,
            }),
          ]),
          Animated.sequence([
            Animated.delay(750),
            Animated.timing(rippleAnim2, {
              toValue: 1,
              duration: 1500,
              useNativeDriver: true,
            }),
            Animated.timing(rippleAnim2, {
              toValue: 0,
              duration: 0,
              useNativeDriver: true,
            }),
          ]),
        ])
      );
      rippleLoop.start();
    } else {
      rippleAnim1.setValue(0);
      rippleAnim2.setValue(0);
    }

    return () => {
      if (rippleLoop) rippleLoop.stop();
    };
  }, [isPressing]);

  const handlePressIn = () => {
    setIsPressing(true);
    
    // Scale down slightly to feel tactile
    Animated.spring(scaleAnim, {
      toValue: 0.95,
      useNativeDriver: true,
    }).start();

    // Vibrate briefly to indicate press started
    if (Platform.OS !== 'web') {
      Vibration.vibrate(80);
    }

    // Start progress animation (2 seconds)
    Animated.timing(progressAnim, {
      toValue: 1,
      duration: 2000,
      useNativeDriver: false, // SVG or non-native layouts like width/height require false
    }).start(({ finished }) => {
      if (finished) {
        handleTrigger();
      }
    });
  };

  const handlePressOut = () => {
    setIsPressing(false);
    
    // Scale back to normal
    Animated.spring(scaleAnim, {
      toValue: 1,
      friction: 4,
      useNativeDriver: true,
    }).start();

    // Reset progress back to 0
    Animated.timing(progressAnim, {
      toValue: 0,
      duration: 300,
      useNativeDriver: false,
    }).start();
  };

  const handleTrigger = () => {
    if (Platform.OS !== 'web') {
      Vibration.vibrate([0, 200, 100, 200, 100, 500]); // Danger vibration pattern
    }
    setIsPressing(false);
    progressAnim.setValue(0);
    scaleAnim.setValue(1);
    onTrigger();
  };

  // Interpolating progress for circular loading effect or visual bars
  const progressWidth = progressAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%'],
  });

  const rippleScale1 = rippleAnim1.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 2.2],
  });

  const rippleOpacity1 = rippleAnim1.interpolate({
    inputRange: [0, 1],
    outputRange: [0.6, 0],
  });

  const rippleScale2 = rippleAnim2.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 2.2],
  });

  const rippleOpacity2 = rippleAnim2.interpolate({
    inputRange: [0, 1],
    outputRange: [0.6, 0],
  });

  return (
    <View style={styles.container}>
      {/* Background ripples */}
      {isPressing && (
        <>
          <Animated.View
            style={[
              styles.ripple,
              {
                backgroundColor: theme.primary,
                transform: [{ scale: rippleScale1 }],
                opacity: rippleOpacity1,
              },
            ]}
          />
          <Animated.View
            style={[
              styles.ripple,
              {
                backgroundColor: theme.primary,
                transform: [{ scale: rippleScale2 }],
                opacity: rippleOpacity2,
              },
            ]}
          />
        </>
      )}

      {/* Main Button */}
      <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
        <TouchableOpacity
          activeOpacity={0.9}
          onPressIn={handlePressIn}
          onPressOut={handlePressOut}
          style={[styles.button, { backgroundColor: theme.primary }]}
        >
          <View style={styles.innerContent}>
            <Text style={styles.sosText}>SOS</Text>
            <Text style={styles.subText}>
              {isPressing ? 'ĐANG KÍCH HOẠT...' : 'NHẤN GIỮ 2 GIÂY'}
            </Text>
          </View>
        </TouchableOpacity>
      </Animated.View>

      {/* Linear progress bar beneath button to indicate duration */}
      <View style={[styles.progressBarContainer, { backgroundColor: theme.backgroundElement }]}>
        <Animated.View 
          style={[
            styles.progressBar, 
            { 
              backgroundColor: theme.primary,
              width: progressWidth,
            }
          ]} 
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    height: 320,
    width: 320,
  },
  button: {
    width: 200,
    height: 200,
    borderRadius: 100,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    borderWidth: 6,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  innerContent: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  sosText: {
    color: '#FFF',
    fontSize: 48,
    fontWeight: '900',
    letterSpacing: 2,
    textShadowColor: 'rgba(0, 0, 0, 0.3)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  subText: {
    color: 'rgba(255, 255, 255, 0.9)',
    fontSize: 11,
    fontWeight: '700',
    marginTop: 4,
    letterSpacing: 1,
    textAlign: 'center',
  },
  ripple: {
    position: 'absolute',
    width: 200,
    height: 200,
    borderRadius: 100,
    zIndex: -1,
  },
  progressBarContainer: {
    position: 'absolute',
    bottom: 0,
    width: 240,
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  progressBar: {
    height: '100%',
    borderRadius: 4,
  },
});
