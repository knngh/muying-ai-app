import React, { useEffect, useRef } from 'react'
import { Animated, StyleSheet, type ViewStyle } from 'react-native'
import { colors, borderRadius } from '../../theme'

interface SkeletonProps {
  width: number | string
  height: number
  borderRadius?: number
  style?: ViewStyle
}

export default function Skeleton({
  width,
  height,
  borderRadius: br = borderRadius.sm,
  style,
}: SkeletonProps) {
  const opacity = useRef(new Animated.Value(0.3)).current

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 0.7,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0.3,
          duration: 800,
          useNativeDriver: true,
        }),
      ]),
    )
    animation.start()
    return () => animation.stop()
  }, [opacity])

  return (
    <Animated.View
      style={[
        styles.skeleton,
        {
          width: width as any,
          height,
          borderRadius: br,
          opacity,
        },
        style,
      ]}
    />
  )
}

const styles = StyleSheet.create({
  skeleton: {
    backgroundColor: colors.border,
  },
})
