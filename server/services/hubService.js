const Hub = require('../models/Hub');

const getAllHubs = async ({ includeInactive = false } = {}) => {
  const filter = includeInactive ? {} : { isActive: true };
  return Hub.find(filter).sort({ name: 1 }).lean();
};

const createHub = async ({ name, city = '', country = '' }) => {
  if (!name?.trim()) throw new Error('Hub name is required');
  return Hub.create({ name: name.trim(), city: city.trim(), country: country.trim() });
};

const updateHub = async (id, { name, city, country, isActive }) => {
  const hub = await Hub.findById(id);
  if (!hub) throw new Error('Hub not found');

  if (name !== undefined) hub.name = name.trim();
  if (city !== undefined) hub.city = city.trim();
  if (country !== undefined) hub.country = country.trim();
  if (isActive !== undefined) hub.isActive = isActive;

  await hub.save();
  return hub;
};

module.exports = { getAllHubs, createHub, updateHub };
