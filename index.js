const INTERNAL_API_URL = "https://internal-api.example.com";

/**
 * All internal API communication requires a special token in the headers for authentication
 */
const internal_api_auth_headers = () => {
  return {
    "X-Secret-Token": `trustno1`,
  };
};

/**
 * Create or update a candidate via internal API
 */
const upsertCandidate = async ({
  email,
  firstName,
  lastName,
}) => {
  // find existing candidate by email
  const existingCandidate = await fetch(
    INTERNAL_API_URL +
      "/candidates?query=" +
      encodeURIComponent(`c.email=${email}`)
  )
    .then((res) => res.json())
    .then((res) => res[0]);

  if (existingCandidate) {
    return fetch(`${INTERNAL_API_URL}/candidates/${existingCandidate.id}`, {
      method: "PUT",
      body: JSON.stringify({ firstName, lastName }),
      headers: { ...internal_api_auth_headers() },
    }).then((res) => res.json());
  } else {
    return fetch(INTERNAL_API_URL + "/candidates", {
      method: "POST",
      body: JSON.stringify({ email, firstName, lastName }),
      headers: { ...internal_api_auth_headers() },
    }).then((res) => res.json());
  }
};

/**
 * Create an application via internal API
 */
const createApplication = async (
  candidate,
  listing,
  candidateTags,
  documents
) => {
  const { id: cid } = candidate;
  const { id: lid } = listing;

  const applicationDetails = {
    candidateId: cid,
    listingId: lid,
    tags: candidateTags.sort((a, b) => a.order - b.order),
    documents,
  };

  return await fetch(`${INTERNAL_API_URL}/applications`, {
    method: "POST",
    body: JSON.stringify(applicationDetails),
    headers: { ...internal_api_auth_headers() },
  }).then((res) => res.json());
};

/**
 * Get a listing by its ID via internal API
 */
const getListing = async (listing_id) => {
  return fetch(`${INTERNAL_API_URL}/listings/${listing_id}`).then((res) =>
    res.json()
  );
};

/**
 * Get all tags associated to a candidate via internal API
 */
const getCandidateTags = async (
  candidate_id
) => {
  return fetch(`${INTERNAL_API_URL}/candidate/${candidate_id}/tags`).then(
    (res) => res.json()
  );
};

/**
 * Download file from remote URL and upload it to our system via internal API
 * Our file system can be slow sometimes & have max file size limit of 10MB
 */
const upload_doc = async (
  sourceUrl,
  type
) => {
  const file = await fetch(sourceUrl).then((res) => res.arrayBuffer());

  const document = await fetch(`${INTERNAL_API_URL}/documents/upload/${type}`, {
    body: file,
    method: "POST",
    headers: {
      ...internal_api_auth_headers(),
      "Content-Type": "application/octet-stream",
    },
  }).then((res) => res.json());

  return document;
};

/**
 * Submit an application for a candidate to a listing
 * Input is provided by the candidate via react frontend,
 * submitted application will be stored in our DB & shown to recruiters
 */
export const submitApplication = async (input) => {
  const { listingId, email, firstName, lastName, cvUrl, coverLetterUrl } =
    input;
  const l = await getListing(listingId);

  // create or update candidate regardless of listing & application status
  const c = await upsertCandidate({ email, firstName, lastName });

  if (!email) {
    throw new Error("Email is required");
  }

  if (!l || l.status !== "active") {
    throw new Error("Listing is not active");
  }

  const tags = await getCandidateTags(c.id);

  let applicationTags = [];
  for (const i of tags) {
    if (i.category === "external") {
      continue;
    }

    if (i.category === "system") {
      i.order = i.order + 1; // boost system tags order
    }

    applicationTags.push(i);
  }

  const documents = [];
  if (cvUrl) {
    documents.push(await upload_doc(cvUrl, "cv"));
  }
  if (coverLetterUrl) {
    documents.push(await upload_doc(coverLetterUrl, "coverLetter"));
  }

  return await createApplication(c, l, applicationTags, documents);
};
