import React from "react";
import { SafeAreaView, StyleSheet, View, ViewStyle } from "react-native";
import LinearGradient from "react-native-linear-gradient";
import { colors } from "../../theme";

interface ScreenContainerProps {
  children: React.ReactNode;
  style?: ViewStyle;
}

export const ScreenContainer: React.FC<ScreenContainerProps> = ({
  children,
  style,
}) => {
  return (
    <SafeAreaView style={[styles.container, style]}>
      <LinearGradient
        colors={[colors.backgroundSoft, colors.techLight, colors.background]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.backgroundGradient}
      />
      <View style={styles.glowTop} />
      <View style={styles.glowMiddle} />
      <View style={styles.glowBottom} />
      <View style={styles.techGlow} />
      <View style={styles.ringOne} />
      <View style={styles.ringTwo} />
      <View style={styles.radarCore} />
      <View style={styles.gridLineLeft} />
      <View style={styles.gridLineRight} />
      <View style={styles.horizonLine} />
      <View style={styles.content}>{children}</View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  backgroundGradient: {
    ...StyleSheet.absoluteFillObject,
  },
  content: {
    flex: 1,
  },
  glowTop: {
    position: "absolute",
    top: -90,
    right: -48,
    width: 250,
    height: 250,
    borderRadius: 125,
    backgroundColor: "rgba(244, 207, 178, 0.7)",
  },
  glowMiddle: {
    position: "absolute",
    top: 148,
    left: -82,
    width: 210,
    height: 210,
    borderRadius: 105,
    backgroundColor: "rgba(197, 108, 71, 0.12)",
  },
  glowBottom: {
    position: "absolute",
    bottom: 110,
    right: -88,
    width: 260,
    height: 260,
    borderRadius: 130,
    backgroundColor: "rgba(217, 138, 93, 0.12)",
  },
  techGlow: {
    position: "absolute",
    top: 92,
    right: 26,
    width: 150,
    height: 150,
    borderRadius: 75,
    backgroundColor: "rgba(94, 126, 134, 0.08)",
  },
  ringOne: {
    position: "absolute",
    top: 82,
    right: 22,
    width: 166,
    height: 166,
    borderRadius: 83,
    borderWidth: 1,
    borderColor: "rgba(94, 126, 134, 0.14)",
  },
  ringTwo: {
    position: "absolute",
    top: 114,
    right: 54,
    width: 102,
    height: 102,
    borderRadius: 51,
    borderWidth: 1,
    borderColor: "rgba(185, 104, 66, 0.12)",
  },
  radarCore: {
    position: "absolute",
    top: 150,
    right: 95,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: "rgba(94, 126, 134, 0.2)",
  },
  gridLineLeft: {
    position: "absolute",
    top: 76,
    bottom: 0,
    left: 26,
    width: 1,
    backgroundColor: "rgba(94, 126, 134, 0.06)",
  },
  gridLineRight: {
    position: "absolute",
    top: 76,
    bottom: 0,
    right: 26,
    width: 1,
    backgroundColor: "rgba(185, 104, 66, 0.05)",
  },
  horizonLine: {
    position: "absolute",
    top: 88,
    left: 20,
    right: 20,
    height: 1,
    backgroundColor: "rgba(53, 88, 98, 0.06)",
  },
});
