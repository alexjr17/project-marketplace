import {
  CreditCard, Flame, Gift, Heart, Package, Palette, Percent, RotateCcw, Shield, Sparkles, Star, Truck, Zap,
  type LucideIcon,
} from 'lucide-react';

/** Iconos de las tarjetas de características (Ajustes > Página de inicio > Características). */
export const FEATURE_ICON_COMPONENTS: Record<string, LucideIcon> = {
  palette: Palette,
  sparkles: Sparkles,
  flame: Flame,
  package: Package,
  truck: Truck,
  shield: Shield,
  heart: Heart,
  star: Star,
  zap: Zap,
  gift: Gift,
  percent: Percent,
  refresh: RotateCcw,
  card: CreditCard,
};

export const featureIcon = (id?: string): LucideIcon => (id && FEATURE_ICON_COMPONENTS[id]) || Sparkles;
