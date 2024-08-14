import * as nock from "nock";
import { submitApplication } from "./index";

describe("submitApplication", () => {
  const MOCK_API = nock("https://internal-api.example.com");

  it("should submit application for existing candidate", async () => {
    MOCK_API.get(
      `/candidates?query=${encodeURIComponent("c.email=test@example.com")}`
    ).reply(200, [{ id: "candidate1" }]);
    MOCK_API.put("/candidates/candidate1").reply(200, { id: "candidate1" });
    MOCK_API.get("/listings/listing1").reply(200, {
      id: "listing1",
      status: "active",
    });
    MOCK_API.get("/candidates/candidate1/tags").reply(200, []);

    MOCK_API.post("/applications").reply(200, {
      id: "application1",
    });

    const result = await submitApplication({
      listingId: "listing1",
      email: "test@example.com",
      firstName: "John",
      lastName: "Doe",
    });

    expect(result).toEqual({ id: "application1" });
  });

  it("should throw error for closed", async () => {
    MOCK_API.get(
      `/candidates?query=${encodeURIComponent("c.email=test@example.com")}`
    ).reply(200, [{ id: "candidate1" }]);
    MOCK_API.put("/candidates/candidate1").reply(200, { id: "candidate1" });
    MOCK_API.get("/listings/listing1").reply(200, {
      id: "listing1",
      status: "closed",
    });

    await expect(
      submitApplication({
        listingId: "listing1",
        email: "test@example.com",
        firstName: "John",
        lastName: "Doe",
      })
    ).rejects.toThrow("Listing is not active");
  });
});
