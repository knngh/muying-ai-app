import React from "react";
import { StyleSheet, StyleProp, ViewStyle } from "react-native";
import { Card } from "react-native-paper";
import { colors, spacing, borderRadius } from "../../theme";

interface StandardCardProps {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  onPress?: () => void;
  elevation?: 0 | 1 | 2 | 3 | 4 | 5;
}

export const StandardCard: React.FC<StandardCardProps> = ({
  children,
  style,
  onPress,
  elevation = 1,
}) => {
  return (
    <Card
      style={[styles.card, style]}
      onPress={onPress}
      mode={(elevation ? "elevated" : "outlined") as any}
      elevation={elevation === 1 ? 0 : elevation} // Use flat design or reduced shadow for default elevated cards to keep it airy
    >
      {children}
    </Card>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surfaceGlass,
    borderRadius: borderRadius.lg,
    overflow: "hidden",
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: "rgba(185, 104, 66, 0.14)",
    shadowColor: colors.shadowStrong,
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 0.12,
    shadowRadius: 26,
  },
});
