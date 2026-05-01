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
        colors={[colors.backgroundSoft, colors.background, colors.backgroundDeep]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.backgroundGradient}
      />
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
  gridLineLeft: {
    position: "absolute",
    top: 76,
    bottom: 0,
    left: 26,
    width: 1,
    backgroundColor: "rgba(79, 131, 144, 0.05)",
  },
  gridLineRight: {
    position: "absolute",
    top: 76,
    bottom: 0,
    right: 26,
    width: 1,
    backgroundColor: "rgba(79, 131, 144, 0.04)",
  },
  horizonLine: {
    position: "absolute",
    top: 88,
    left: 20,
    right: 20,
    height: 1,
    backgroundColor: "rgba(79, 131, 144, 0.05)",
  },
});
