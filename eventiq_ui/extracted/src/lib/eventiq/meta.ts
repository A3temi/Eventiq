import type { EventStatus, EventType, VendorCategory, VendorStatus } from "./types";
import {
  Cake,
  Camera,
  Car,
  Disc3,
  Flower2,
  MapPin,
  Sparkles,
  Utensils,
  Package,
  type LucideIcon,
} from "lucide-react";

export const vendorCategoryMeta: Record<
  VendorCategory,
  { label: string; icon: LucideIcon }
> = {
  flowers: { label: "Flowers", icon: Flower2 },
  cake: { label: "Cake", icon: Cake },
  catering: { label: "Catering", icon: Utensils },
  dj: { label: "DJ & Music", icon: Disc3 },
  photography: { label: "Photography", icon: Camera },
  venue: { label: "Venue", icon: MapPin },
  transport: { label: "Transport", icon: Car },
  decoration: { label: "Decoration", icon: Sparkles },
  other: { label: "Other", icon: Package },
};

export const vendorStatusMeta: Record<
  VendorStatus,
  { label: string; tone: "success" | "primary" | "warning" | "info" | "danger" }
> = {
  booked: { label: "Booked", tone: "success" },
  deposit_paid: { label: "Deposit paid", tone: "primary" },
  awaiting_confirmation: { label: "Awaiting confirmation", tone: "warning" },
  quote_requested: { label: "Quote requested", tone: "info" },
  delivered: { label: "Delivered", tone: "success" },
  cancelled: { label: "Cancelled", tone: "danger" },
};

export const eventStatusMeta: Record<
  EventStatus,
  { label: string; dot: string }
> = {
  planning: { label: "Planning", dot: "bg-info" },
  confirmed: { label: "Confirmed", dot: "bg-success" },
  in_progress: { label: "In progress", dot: "bg-warning" },
  completed: { label: "Completed", dot: "bg-success" },
  draft: { label: "Draft", dot: "bg-pending" },
};

export const eventTypeMeta: Record<EventType, { label: string }> = {
  wedding: { label: "Wedding" },
  corporate: { label: "Corporate" },
  birthday: { label: "Birthday" },
  launch: { label: "Product launch" },
  social: { label: "Social" },
  other: { label: "Other" },
};

export const toneClasses: Record<string, string> = {
  success: "bg-success/10 text-success ring-1 ring-inset ring-success/20",
  primary: "bg-primary/10 text-primary ring-1 ring-inset ring-primary/20",
  warning: "bg-warning/10 text-warning ring-1 ring-inset ring-warning/20",
  info: "bg-info/10 text-info ring-1 ring-inset ring-info/20",
  danger: "bg-destructive/10 text-destructive ring-1 ring-inset ring-destructive/20",
  muted: "bg-muted text-muted-foreground ring-1 ring-inset ring-border",
};