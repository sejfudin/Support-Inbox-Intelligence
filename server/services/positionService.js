const Position = require('../models/Position');

const getAllPositions = async () => Position.find().sort({ name: 1 }).lean();

module.exports = {
  getAllPositions,
};
