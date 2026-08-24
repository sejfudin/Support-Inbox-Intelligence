// Wiring-level cover for the CV upload → technology merge path. The merge rules themselves live
// in helpers/cvTechnologySync.test.js; what this checks is that uploadInternCv feeds the real
// matcher, writes the profile, saves, and reports the additions back to the caller — and that a
// re-upload can never shorten the intern's list, whatever the new PDF says or fails to say.

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

const mockCatalog = () => {
  Technology.find.mockImplementation(() => ({ select: () => ({ lean: async () => CATALOG }) }));
};

// react came from the previous CV scan, python the intern declared by hand — after this change
// the two are indistinguishable to the service, which is the point.
const mockProfile = (overrides = {}) => {
  const profile = {
    cvPath: 'interns/u1/cv/old.pdf',
    selfTechnologies: ['t-react', 't-python'],
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
  it('adds what a re-upload recognises without dropping what is already there', async () => {
    const profile = mockProfile();
    extractPdfText.mockResolvedValue('Skills: Vue.js, some prose about projects.');

    const result = await upload();

    expect(profile.selfTechnologies).toEqual(['t-react', 't-python', 't-vue']);
    expect(result.addedTechnologies).toEqual([{ _id: 't-vue', name: 'Vue.js', slug: 'vue-js' }]);
    expect(profile.save).toHaveBeenCalledTimes(1);
  });

  it('keeps the whole list when a readable CV matches nothing', async () => {
    const profile = mockProfile();
    extractPdfText.mockResolvedValue('Enthusiastic graduate seeking a first full-time role.');

    const result = await upload();

    expect(profile.selfTechnologies).toEqual(['t-react', 't-python']);
    expect(result.addedTechnologies).toEqual([]);
  });

  it('leaves the list untouched when the PDF yields no text', async () => {
    const profile = mockProfile();
    extractPdfText.mockResolvedValue('');

    const result = await upload();

    expect(profile.selfTechnologies).toEqual(['t-react', 't-python']);
    expect(result.addedTechnologies).toEqual([]);
    // The upload itself still succeeds and points at the new file.
    expect(profile.cvPath).toMatch(/^interns\/u1\/cv\//);
    expect(profile.save).toHaveBeenCalledTimes(1);
  });

  it('does not re-add anything when the same CV is uploaded again', async () => {
    const profile = mockProfile();
    extractPdfText.mockResolvedValue('Skills: React, Python');

    const result = await upload();

    expect(profile.selfTechnologies).toEqual(['t-react', 't-python']);
    expect(result.addedTechnologies).toEqual([]);
  });

  it('leaves the list untouched when the catalog lookup throws', async () => {
    const profile = mockProfile();
    extractPdfText.mockResolvedValue('Skills: Vue.js');
    Technology.find.mockImplementation(() => ({
      select: () => ({
        lean: async () => {
          throw new Error('mongo down');
        },
      }),
    }));

    const result = await upload();

    expect(profile.selfTechnologies).toEqual(['t-react', 't-python']);
    expect(result.addedTechnologies).toEqual([]);
    // Best-effort: the CV itself is still uploaded and saved.
    expect(profile.save).toHaveBeenCalledTimes(1);
  });

  it('populates an empty list on a first-ever scan', async () => {
    const profile = mockProfile({ cvPath: null, selfTechnologies: [] });
    extractPdfText.mockResolvedValue('Skills: React, Vue.js');

    const result = await upload();

    expect(profile.selfTechnologies).toEqual(['t-react', 't-vue']);
    expect(result.addedTechnologies.map((t) => t.name)).toEqual(['React', 'Vue.js']);
    expect(result.cvUrl).toMatch(/^https:\/\/cdn\.test\/interns\/u1\/cv\//);
  });
});
