export const capitalizeFirst = (str) => {
  if (!str || typeof str !== 'string') return "";
  
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
};