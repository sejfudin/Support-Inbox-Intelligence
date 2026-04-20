export const STORY_POINTS_MIN = 1;
export const STORY_POINTS_MAX = 5;

export const STORY_POINTS_OPTIONS = Array.from(
    { length: STORY_POINTS_MAX - STORY_POINTS_MIN + 1 },
    (_, index) => {
        const value = STORY_POINTS_MIN + index;

        return {
            value,
            label: String(value)
        }
    },
);

export const STORY_POINTS_VISUALS = {
  1: {
    badge: "bg-emerald-100 text-emerald-700 hover:bg-emerald-200",
    indicator: "bg-emerald-50 text-emerald-700 border-emerald-300",
    dot: "bg-emerald-500",
  },
  2: {
    badge: "bg-cyan-100 text-cyan-700 hover:bg-cyan-200",
    indicator: "bg-cyan-50 text-cyan-700 border-cyan-300",
    dot: "bg-cyan-500",
  },
  3: {
    badge: "bg-blue-100 text-blue-700 hover:bg-blue-200",
    indicator: "bg-blue-50 text-blue-700 border-blue-300",
    dot: "bg-blue-500",
  },
  4: {
    badge: "bg-orange-100 text-orange-700 hover:bg-orange-200",
    indicator: "bg-orange-50 text-orange-700 border-orange-300",
    dot: "bg-orange-500",
  },
  5: {
    badge: "bg-red-100 text-red-700 hover:bg-red-200",
    indicator: "bg-red-50 text-red-700 border-red-300",
    dot: "bg-red-500",
  },
  default: {
    badge: "bg-gray-100 text-gray-600 hover:bg-gray-200",
    indicator: "bg-gray-50 text-gray-600 border-gray-300",
    dot: "bg-gray-400",
  },
};


export const getStoryPointsStyle = (value) =>
  STORY_POINTS_VISUALS[value] || STORY_POINTS_VISUALS.default;



export const normalizeStoryPoints = (value) => {
    if (value === null || value === undefined || value === "") return null;

    const parsed = Number(value);
    if (!Number.isInteger(parsed)) return null;
    if (parsed < STORY_POINTS_MIN || parsed > STORY_POINTS_MAX) return null;


    return parsed; 
};

