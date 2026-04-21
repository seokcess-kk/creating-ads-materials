export type ChannelAspectRatio = "1:1" | "4:5" | "9:16" | "16:9";

export function aspectClass(ar: ChannelAspectRatio | undefined): string {
  switch (ar) {
    case "9:16":
      return "aspect-[9/16]";
    case "4:5":
      return "aspect-[4/5]";
    case "16:9":
      return "aspect-[16/9]";
    default:
      return "aspect-square";
  }
}

export function maxHeightClass(ar: ChannelAspectRatio | undefined): string {
  switch (ar) {
    case "9:16":
      return "max-h-[80vh]";
    case "16:9":
      return "max-h-[50vh]";
    case "4:5":
      return "max-h-[75vh]";
    default:
      return "max-h-[70vh]";
  }
}

export function variantGridCols(ar: ChannelAspectRatio | undefined): string {
  switch (ar) {
    case "9:16":
      return "grid-cols-2 md:grid-cols-4";
    case "16:9":
      return "grid-cols-1 md:grid-cols-2";
    case "4:5":
      return "grid-cols-2 md:grid-cols-3";
    default:
      return "grid-cols-2 md:grid-cols-3";
  }
}

export function composeGridCols(ar: ChannelAspectRatio | undefined): string {
  switch (ar) {
    case "9:16":
      return "grid-cols-2 md:grid-cols-3";
    case "16:9":
      return "grid-cols-1 md:grid-cols-2";
    default:
      return "grid-cols-1 md:grid-cols-2";
  }
}

export function retouchTurnCols(ar: ChannelAspectRatio | undefined): string {
  switch (ar) {
    case "9:16":
      return "grid-cols-2 md:grid-cols-4";
    case "16:9":
      return "grid-cols-1 md:grid-cols-2";
    default:
      return "grid-cols-2 md:grid-cols-3";
  }
}

export function previewLayoutClass(ar: ChannelAspectRatio | undefined): string {
  if (ar === "16:9") return "grid-cols-1 gap-4";
  return "md:grid-cols-[1fr_280px] gap-4";
}

export function previewContainerMaxVh(ar: ChannelAspectRatio | undefined): string {
  switch (ar) {
    case "9:16":
      return "80vh";
    case "16:9":
      return "50vh";
    case "4:5":
      return "75vh";
    default:
      return "70vh";
  }
}
