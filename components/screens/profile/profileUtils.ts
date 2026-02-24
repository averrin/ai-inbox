import { Colors } from '../../ui/design-tokens';

export const getLevelChipProps = (level: number) => {
    if (level <= 0.3) return { label: 'Fact', color: Colors.primary, variant: 'outline' as const };
    if (level <= 0.7) return { label: 'Routine', color: Colors.primary, variant: 'solid' as const };
    return { label: 'Value', color: Colors.warning, variant: 'solid' as const };
};

export const getDepthLabel = (level: number) => {
    if (level < 0.35) return "Concrete Facts";
    if (level < 0.65) return "Habits & Routine";
    return "Deep Philosophy";
};
