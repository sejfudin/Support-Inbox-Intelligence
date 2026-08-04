// Wiring-level cover for the CV re-upload → technology replacement path. The reconciliation
// rules themselves live in helpers/cvTechnologySync.test.js; what this checks is that
// uploadInternCv feeds the real matcher, writes both profile fields, saves, and reports the
// removals back to the caller. Mongo and Supabase are mocked — no DB or network.

jest.mock('../config/supabase', () => ({
  supabase: {
    storage: {
      from: () => ({
        upload: jest.fn().mockResolvedValue({ error: null }),
        remove: jest.fn().mockResolvedValue({ error: null }),
        getPublicUrl: (path) => ({ data: { publicUrl: `https://cdn.test/${path}` } }),
      }),
    },
  },
  supabaseCvBucket: 'cvs',
}));

jest.mock('../helpers/pdfText', () => ({ extractPdfText: jest.fn() }));
jest.mock('../models/InternProfile', () => ({ findOne: jest.fn() }));
jest.mock('../models/Technology', () => ({ find: jest.fn() }));

const InternProfile = require('../models/InternProfile');
const Technology = require('../models/Technology');
const { extractPdfText } = require('../helpers/pdfText');
const { uploadInternCv } = require('./internCvService');

const CATALOG = [
  { _id: 't-react', name: 'React', slug: 'react' },
  { _id: 't-vue', name: 'Vue.js', slug: 'vue-js' },
  { _id: 't-python', name: 'Python', slug: 'python' },
];

const byId = (id) => CATALOG.find((tech) => tech._id === id);

// Technology.find(...).select(...).lean() for both call shapes the service uses:
// the active catalog, and an id lookup used to name removed technologies.
const mockCatalog = () => {
  Technology.find.mockImplementation((filter) => {
    const ids = filter?._id?.$in;
    const rows = ids ? ids.map(byId).filter(Boolean) : CATALOG;
    return { select: () => ({ lean: async () => rows }) };
  });
};

// python was declared by hand; react came from the previous CV scan.
const mockProfile = (overrides = {}) => {
  const profile = {
    cvPath: 'interns/u1/cv/old.pdf',
    selfTechnologies: ['t-react', 't-python'],
    cvTechnologies: ['t-react'],
    save: jest.fn().mockResolvedValue(undefined),
    ...overrides,
  };
  InternProfile.findOne.mockResolvedValue(profile);
  return profile;
};

const upload = () =>
  uploadInternCv({
    userId: 'u1',
    file: { buffer: Buffer.from('%PDF'), mimetype: 'application/pdf' },
  });

beforeEach(() => {
  jest.clearAllMocks();
  mockCatalog();
});

describe('uploadInternCv technology sync', () => {
  it('replaces the previous scan and reports both deltas', async () => {
    const profile = mockProfile();
    extractPdfText.mockResolvedValue('Skills: Vue.js, some prose about projects.');

    const result = await upload();

    // react (CV-owned, not in the new CV) is gone; python (manual) survives; vue is added.
    expect(profile.selfTechnologies).toEqual(['t-python', 't-vue']);
    expect(profile.cvTechnologies).toEqual(['t-vue']);
    expect(result.addedTechnologies).toEqual([{ _id: 't-vue', name: 'Vue.js', slug: 'vue-js' }]);
    expect(result.removedTechnologies).toEqual([{ _id: 't-react', name: 'React', slug: 'react' }]);
    expect(profile.save).toHaveBeenCalledTimes(1);
  });

  it('clears the previous scan when a readable CV matches nothing', async () => {
    const profile = mockProfile();
    extractPdfText.mockResolvedValue('Enthusiastic graduate seeking a first full-time role.');

    const result = await upload();

    expect(profile.selfTechnologies).toEqual(['t-python']);
    expect(profile.cvTechnologies).toEqual([]);
    expect(result.addedTechnologies).toEqual([]);
    expect(result.removedTechnologies.map((t) => t.name)).toEqual(['React']);
  });

  it('leaves the list untouched when the PDF yields no text', async () => {
    const profile = mockProfile();
    extractPdfText.mockResolvedValue('');

    const result = await upload();

    // An image-only or corrupt CV is not evidence the intern dropped React.
    expect(profile.selfTechnologies).toEqual(['t-react', 't-python']);
    expect(profile.cvTechnologies).toEqual(['t-react']);
    expect(result.addedTechnologies).toEqual([]);
    expect(result.removedTechnologies).toEqual([]);
    // The upload itself still succeeds and points at the new file.
    expect(profile.cvPath).toMatch(/^interns\/u1\/cv\//);
    expect(profile.save).toHaveBeenCalledTimes(1);
  });

  it('does not re-add or remove anything when the same CV is uploaded again', async () => {
    const profile = mockProfile({
      selfTechnologies: ['t-react', 't-python'],
      cvTechnologies: ['t-react'],
    });
    extractPdfText.mockResolvedValue('Skills: React, Python');

    const result = await upload();

    expect(profile.selfTechnologies).toEqual(['t-react', 't-python']);
    // python was matched but stays intern-owned — it predates any scan.
    expect(profile.cvTechnologies).toEqual(['t-react']);
    expect(result.addedTechnologies).toEqual([]);
    expect(result.removedTechnologies).toEqual([]);
  });

  it('leaves the list untouched when the catalog lookup throws mid-sync', async () => {
    const profile = mockProfile();
    extractPdfText.mockResolvedValue('Skills: Vue.js');
    // Fail the second query (the one that names removed technologies), i.e. after the new list
    // has been computed — the profile must still come out unchanged rather than half-applied.
    Technology.find
      .mockImplementationOnce(() => ({ select: () => ({ lean: async () => CATALOG }) }))
      .mockImplementationOnce(() => ({
        select: () => ({
          lean: async () => {
            throw new Error('mongo down');
          },
        }),
      }));

    const result = await upload();

    expect(profile.selfTechnologies).toEqual(['t-react', 't-python']);
    expect(profile.cvTechnologies).toEqual(['t-react']);
    expect(result.addedTechnologies).toEqual([]);
    expect(result.removedTechnologies).toEqual([]);
  });

  it('still records provenance on a first-ever scan', async () => {
    const profile = mockProfile({ cvPath: null, selfTechnologies: [], cvTechnologies: [] });
    extractPdfText.mockResolvedValue('Skills: React, Vue.js');

    const result = await upload();

    expect(profile.selfTechnologies).toEqual(['t-react', 't-vue']);
    expect(profile.cvTechnologies).toEqual(['t-react', 't-vue']);
    expect(result.removedTechnologies).toEqual([]);
    expect(result.cvUrl).toMatch(/^https:\/\/cdn\.test\/interns\/u1\/cv\//);
  });
});
