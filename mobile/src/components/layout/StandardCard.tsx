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
    borderWidth: 1.5,
    borderColor: "rgba(255, 255, 255, 0.5)",
    shadowColor: "rgba(110, 120, 140, 0.15)",
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 1,
    shadowRadius: 28,
  },
});
