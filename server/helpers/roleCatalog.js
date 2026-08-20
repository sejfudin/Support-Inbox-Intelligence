// Position names are role titles ("DevOps Engineer", "Cloud Architect"); Technology names are
// concrete tools/languages/frameworks ("Docker", "AWS"). Stripping the generic role suffix lets
// createPosition/createTechnology catch someone naming a Technology after the bare discipline
// ("DevOps") without flagging real tool names that merely contain a role word (e.g. "Google
// Cloud" must stay allowed next to the "Cloud Architect" position).
const ROLE_SUFFIXES = /\s+(engineer|developer|designer|architect|administrator)$/i;

const roleRoot = (name) => name.trim().toLowerCase().replace(ROLE_SUFFIXES, '').trim();

const escapeRegExp = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

module.exports = { roleRoot, escapeRegExp };
