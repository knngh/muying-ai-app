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
  const cardStyle = [styles.card, style]

  if (elevation > 0) {
    return (
      <Card
        style={cardStyle}
        onPress={onPress}
        mode="elevated"
        elevation={elevation === 1 ? 0 : elevation} // Use flat design or reduced shadow for default elevated cards to keep it airy
      >
        {children}
      </Card>
    )
  }

  return (
    <Card
      style={cardStyle}
      onPress={onPress}
      mode="outlined"
    >
      {children}
    </Card>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surfaceGlass,
    borderRadius: borderRadius.md,
    overflow: "hidden",
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: colors.shadowSoft,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.1,
    shadowRadius: 16,
  },
});
