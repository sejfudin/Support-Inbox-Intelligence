jest.mock('../models/Recommendation', () => ({
  insertMany: jest.fn(),
  find: jest.fn(),
  updateOne: jest.fn(),
  RECOMMENDATION_STATUSES: ['recommended', 'interviewing', 'resulted'],
  RECOMMENDATION_RESULTS: ['placed', 'not_placed'],
}));
jest.mock('../models/InternProfile', () => ({
  find: jest.fn(),
  READY_STATUS: 'ready_for_placement',
}));
jest.mock('../models/Technology', () => ({}));
jest.mock('../models/Position', () => ({ find: jest.fn() }));
jest.mock('../models/Project', () => ({ find: jest.fn(), findById: jest.fn() }));
jest.mock('../models/User', () => ({}));
jest.mock('./internCvService', () => ({ buildCvUrl: jest.fn() }));
jest.mock('../socket/events', () => ({ emitInternDataChanged: jest.fn() }));
jest.mock('./historyService', () => ({
  logEntityEvent: jest.fn().mockResolvedValue(undefined),
  getLatestStatusDates: jest.fn().mockResolvedValue({}),
}));
jest.mock('./internNotificationService', () => ({
  notifyRecommendationCreated: jest.fn(),
  notifyRecommendationNotPlaced: jest.fn(),
}));

const Recommendation = require('../models/Recommendation');
const InternProfile = require('../models/InternProfile');
const Position = require('../models/Position');
const Project = require('../models/Project');
const notifications = require('./internNotificationService');
const {
  createRecommendationsForStaffingRequest,
  closeOutRecommendationsForDemandEnd,
} = require('./recommendationService');

const leanQuery = (value) => ({ select: () => ({ lean: async () => value }) });

beforeEach(() => jest.clearAllMocks());

it('notifies every intern created through a staffing request', async () => {
  Recommendation.insertMany.mockImplementation(async (documents) =>
    documents.map((document, index) => ({ ...document, _id: `recommendation-${index}` }))
  );
  InternProfile.find.mockReturnValue(
    leanQuery([
      { _id: 'profile-1', user: 'user-1' },
      { _id: 'profile-2', user: 'user-2' },
    ])
  );
  Position.find.mockReturnValue(leanQuery([{ _id: 'position-1', name: 'Developer' }]));
  Project.findById.mockReturnValue(leanQuery({ _id: 'project-1', name: 'Kestrel' }));

  await createRecommendationsForStaffingRequest(
    { _id: 'admin-1', role: 'admin' },
    {
      projectId: 'project-1',
      staffingRequestId: 'request-1',
      groups: [
        {
          positionId: 'position-1',
          internProfileIds: ['profile-1', 'profile-2'],
          technologyIds: [],
        },
      ],
    }
  );

  expect(notifications.notifyRecommendationCreated).toHaveBeenCalledTimes(2);
  expect(notifications.notifyRecommendationCreated).toHaveBeenCalledWith({
    internUserId: 'user-1',
    internProfileId: 'profile-1',
    position: 'Developer',
    project: 'Kestrel',
  });
});

it('notifies interns whose active recommendation is closed with ended demand', async () => {
  const recommendation = {
    _id: 'recommendation-1',
    internProfile: 'profile-1',
    position: 'position-1',
    project: 'project-1',
    status: 'interviewing',
    statusDates: { recommended: new Date() },
  };
  Recommendation.find.mockReturnValue({ select: async () => [recommendation] });
  Recommendation.updateOne.mockResolvedValue(undefined);
  InternProfile.find
    .mockReturnValueOnce([])
    .mockReturnValueOnce(leanQuery([{ _id: 'profile-1', user: 'user-1' }]));
  Project.find.mockReturnValue(leanQuery([{ _id: 'project-1', name: 'Kestrel' }]));

  await closeOutRecommendationsForDemandEnd(
    { _id: 'leader-1', role: 'leadership' },
    {
      staffingRequestId: 'request-1',
      positionIds: ['position-1'],
      reason: 'Demand ended',
      action: 'Request closed',
    }
  );

  expect(notifications.notifyRecommendationNotPlaced).toHaveBeenCalledWith({
    internUserId: 'user-1',
    internProfileId: 'profile-1',
    project: 'Kestrel',
  });
});

// The close-out cascade returns interns to the bench, which lifts their attendance
// exemption. Lifting it must not reopen the days they were already away: absence is
// stored as the *lack* of an attendance row, so clearing `placedAt` on its own bills
// the whole stretch as missed. The closed stint is what prevents that.
it('closes the placement stretch instead of only clearing placedAt', async () => {
  const recommendation = {
    _id: 'recommendation-1',
    internProfile: 'profile-1',
    position: 'position-1',
    project: 'project-1',
    status: 'interviewing',
    statusDates: { recommended: new Date() },
  };
  const placedAt = new Date('2026-06-08');
  const benched = {
    _id: 'profile-1',
    user: 'user-1',
    status: 'active',
    placedAt,
    placementExemptions: [],
    save: jest.fn().mockResolvedValue(undefined),
  };

  Recommendation.find.mockReturnValue({ select: async () => [recommendation] });
  Recommendation.updateOne.mockResolvedValue(undefined);
  InternProfile.find
    .mockReturnValueOnce([benched])
    .mockReturnValueOnce(leanQuery([{ _id: 'profile-1', user: 'user-1' }]));
  Project.find.mockReturnValue(leanQuery([{ _id: 'project-1', name: 'Kestrel' }]));

  await closeOutRecommendationsForDemandEnd(
    { _id: 'leader-1', role: 'leadership' },
    {
      staffingRequestId: 'request-1',
      positionIds: ['position-1'],
      reason: 'Demand ended',
      action: 'Request closed',
    }
  );

  expect(benched.status).toBe('ready_for_placement');
  expect(benched.placedAt).toBeNull();
  expect(benched.placementExemptions).toHaveLength(1);
  expect(benched.placementExemptions[0].from).toBe(placedAt);
  expect(benched.save).toHaveBeenCalledTimes(1);
});
