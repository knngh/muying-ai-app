import React, { useEffect, useRef } from 'react'
import { Animated, StyleSheet, View, type DimensionValue, type ViewStyle } from 'react-native'
import LinearGradient from 'react-native-linear-gradient'
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
  const shimmer = useRef(new Animated.Value(-160)).current
  const skeletonStyle = [
    styles.skeleton,
    {
      width: width as DimensionValue,
      height,
      borderRadius: br,
    },
    style,
  ]
  const skeletonCoreStyle = [styles.skeletonCore, { borderRadius: br }]
  const shimmerStyle = [
    styles.shimmer,
    {
      transform: [{ translateX: shimmer }],
    },
  ]

  useEffect(() => {
    const animation = Animated.loop(
      Animated.timing(shimmer, {
        toValue: 320,
        duration: 1500,
        useNativeDriver: true,
      }),
    )
    animation.start()
    return () => animation.stop()
  }, [shimmer])

  return (
    <View style={skeletonStyle}>
      <View style={skeletonCoreStyle} />
      <Animated.View
        pointerEvents="none"
        style={shimmerStyle}
      >
        <LinearGradient
          colors={['rgba(255,248,242,0)', 'rgba(255,250,246,0.72)', 'rgba(220,236,238,0)']}
          start={{ x: 0, y: 0.5 }}
          end={{ x: 1, y: 0.5 }}
          style={StyleSheet.absoluteFill}
        />
      </Animated.View>
    </View>
  )
}

const styles = StyleSheet.create({
  skeleton: {
    overflow: 'hidden',
    backgroundColor: 'rgba(255,250,245,0.9)',
    borderWidth: 1,
    borderColor: 'rgba(184,138,72,0.1)',
  },
  skeletonCore: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.surfaceMuted,
  },
  shimmer: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 160,
  },
})
