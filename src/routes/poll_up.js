/*
 * Count up vote route, this route will handle all request for updating vote count
 *
 *  Example payload
 *  {
 *    "poll_id" : "1",
 *    "candidate_id": "1",
 *    "email": "test@test.com"
 *  }
 *
 */

const express = require('express');
const models = require('../models');
const router = express.Router();
const sequelize = models.sequelize;
const config = require('../config.json');


//add new route
router.post('/', function(req, res) {
  sequelize.transaction().then(t => { //all in one single transaction

    getVoter(req.body.email, t)
      .spread(voter => [voter, getVoterCount(voter.id, req.body.poll_id, t)])
      .spread((voter, [voterCount]) => {
        if(voterCount.voted < config.maxVoteLimit)
          return [voter, voterCount, getCandidateTotal(req, t)];
        else
          throw('Error more than three times voted !!');
      })
      .spread((voter, voterCount, [candidate]) => updateVote(voterCount, candidate, t))
      .then(result => {
        res.status(201).json({
          statusText: 'success',
          result: result
        });
        return t.commit();
      })
      .catch(error => {
        res.status(403).json({
          statusText: 'error',
          result: error
        });
        return t.rollback();
      });

  });
});

//helper fucntions returns all promise
function getVoter(email, t) {
  return models.voters.findOrCreate({
    where: { email: email },
    defaults: {},
    transaction: t
  });
}

function getVoterCount(voterId, pollId, t) {
  return models.voters_vote_count.findOrCreate({
    where: {
      polls_id: pollId,
      voters_id: voterId
    },
    defaults: {},
    transaction: t
  });
}

function getCandidateTotal(req, t) {
  return models.polls_candidates_total.findOrCreate({
    where: {
      polls_id: req.body.poll_id,
      candidates_id: req.body.candidate_id
    },
    defaults: {},
    transaction: t
  });
}

function updateVote(voterCount, candidate, t) {
  return Promise.all([
    voterCount.update({
      voted: sequelize.literal('voted +1')
    }, {transaction: t}),
    candidate.update({
      total: sequelize.literal('total +1')
    }, {transaction: t})
  ]);
}

module.exports = router;
