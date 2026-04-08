import React from "react";
import { StyleSheet, StyleProp, ViewStyle } from "react-native";
import { Card } from "react-native-paper";
import { colors, spacing } from "../../theme";

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
      mode={elevation ? "elevated" : "contained"}
    >
      {children}
    </Card>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.white,
    borderRadius: 16,
    overflow: "hidden",
    marginBottom: spacing.sm,
  },
});
