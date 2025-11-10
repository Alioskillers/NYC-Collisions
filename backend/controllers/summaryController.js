const { getData } = require('../utils/dataStore');

async function getSummary(req, res) {
  const { crashes } = getData();

  const total_collisions = crashes.length;

  let total_injuries = 0;
  let total_fatalities = 0;

  for (const c of crashes) {
    total_injuries += Number(c.number_of_persons_injured || 0);
    total_fatalities += Number(c.number_of_persons_killed || 0);
  }

  res.json({
    total_collisions,
    total_injuries,
    total_fatalities,
  });
}

module.exports = { getSummary };