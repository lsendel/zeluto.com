import { Hono } from "hono";
import type { Env } from "../index.js";
import {
  SignupView,
  CreateOrgView,
  SelectPlanView,
  SetupView,
} from "../views/onboarding/index";

/**
 * Onboarding routes for the SaaS signup flow
 *
 * Flow:
 * 1. /app/signup → SignupView (Better Auth signup)
 * 2. After signup → /app/onboarding/org → CreateOrgView
 * 3. After org created → /app/onboarding/plan → SelectPlanView
 * 4. After plan selected → /app/onboarding/setup → SetupView
 * 5. After setup complete → /app/dashboard
 */

export function createOnboardingRoutes() {
  const app = new Hono<Env>();

  // ========================================
  // Public Signup Page
  // ========================================
  app.get("/signup", (c) => {
    // Check if user is already authenticated
    const user = c.get("user");
    if (user) {
      return c.redirect("/app/onboarding/org");
    }

    return c.html(<SignupView />);
  });

  // ========================================
  // Onboarding: Create Organization
  // ========================================
  app.get("/onboarding/org", (c) => {
    const user = c.get("user");

    // Require authentication
    if (!user) {
      return c.redirect("/app/signup");
    }

    // Check if user already has an organization
    const organization = c.get("organization");
    if (organization) {
      return c.redirect("/app/onboarding/plan");
    }

    return c.html(<CreateOrgView />);
  });

  // Handle organization creation response
  app.post("/onboarding/org", async (c) => {
    const user = c.get("user");
    if (!user) {
      return c.redirect("/app/signup");
    }

    // Organization is created via POST to /api/v1/identity/organizations
    // This route handles the response and redirects
    return c.redirect("/app/onboarding/plan");
  });

  // ========================================
  // Onboarding: Select Plan
  // ========================================
  app.get("/onboarding/plan", (c) => {
    const user = c.get("user");
    const organization = c.get("organization");

    if (!user) {
      return c.redirect("/app/signup");
    }
    if (!organization) {
      return c.redirect("/app/onboarding/org");
    }

    return c.html(<SelectPlanView />);
  });

  // Handle plan selection
  app.post("/onboarding/plan", async (c) => {
    const user = c.get("user");
    const organization = c.get("organization");

    if (!user || !organization) {
      return c.redirect("/app/signup");
    }

    // Plan selection handled via:
    // - Free plan: POST /api/v1/onboarding/select-plan
    // - Paid plans: POST /api/v1/billing/checkout (creates Stripe session)

    // After successful plan selection, redirect to setup
    return c.redirect("/app/onboarding/setup");
  });

  // ========================================
  // Onboarding: Setup
  // ========================================
  app.get("/onboarding/setup", (c) => {
    const user = c.get("user");
    const organization = c.get("organization");

    if (!user) {
      return c.redirect("/app/signup");
    }
    if (!organization) {
      return c.redirect("/app/onboarding/org");
    }

    // Get current setup step from query param (default: domain)
    const step = c.req.query("step") as "domain" | "provider" | "contacts" | undefined;
    const verified = c.req.query("verified") === "true";

    return c.html(
      <SetupView currentSetupStep={step || "domain"} domainVerified={verified} />
    );
  });

  // ========================================
  // Helper: Generate slug from org name
  // ========================================
  app.get("/onboarding/generate-slug", (c) => {
    const name = c.req.query("name");
    if (!name) {
      return c.html(
        <div id="slug-input">
          <input
            name="slug"
            type="text"
            placeholder="organization-slug"
            class="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
          <p class="mt-1 text-sm text-gray-500">Used in your organization URL</p>
        </div>
      );
    }

    // Generate slug: lowercase, replace spaces with hyphens, remove special chars
    const slug = name
      .toLowerCase()
      .replace(/\s+/g, "-")
      .replace(/[^a-z0-9-]/g, "")
      .replace(/--+/g, "-")
      .replace(/^-|-$/g, "");

    return c.html(
      <div id="slug-input">
        <label for="input-slug" class="mb-1 block text-sm font-medium text-gray-700">
          Organization slug
          <span class="ml-1 text-red-500">*</span>
        </label>
        <input
          id="input-slug"
          name="slug"
          type="text"
          value={slug}
          required
          class="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500"
        />
        <p class="mt-1 text-sm text-gray-500">Used in your organization URL</p>
      </div>
    );
  });

  // ========================================
  // Helper: Select plan (free)
  // ========================================
  app.post("/onboarding/select-plan", async (c) => {
    const user = c.get("user");
    const organization = c.get("organization");

    if (!user || !organization) {
      return c.redirect("/app/signup");
    }

    const body = await c.req.json();
    const plan = body.plan;

    // For free plan, just update the organization and redirect
    if (plan === "free" && organization?.id && user?.id) {
      // Update organization plan via Identity Worker
      await c.env.IDENTITY.fetch(
        new Request(`http://identity/api/v1/organizations/${organization.id}`, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            "X-User-Id": user.id,
          },
          body: JSON.stringify({ plan: "free" }),
        })
      );

      return c.redirect("/app/onboarding/setup");
    }

    return c.redirect("/app/onboarding/plan");
  });

  // ========================================
  // Helper: Skip provider setup
  // ========================================
  app.post("/onboarding/skip-provider", (c) => {
    return c.html(
      <SetupView currentSetupStep="contacts" domainVerified={false} />
    );
  });

  // ========================================
  // Helper: Skip contacts import
  // ========================================
  app.post("/onboarding/skip-contacts", (c) => {
    return c.html(
      <SetupView currentSetupStep="contacts" domainVerified={false} />
    );
  });

  // ========================================
  // Helper: Skip entire setup
  // ========================================
  app.post("/onboarding/skip-setup", (c) => {
    return c.redirect("/app/dashboard");
  });

  // ========================================
  // Complete onboarding
  // ========================================
  app.post("/onboarding/complete", async (c) => {
    const user = c.get("user");
    const organization = c.get("organization");

    if (!user || !organization) {
      return c.redirect("/app/signup");
    }

    // Mark onboarding as complete (could be stored in user metadata)
    // For now, just redirect to dashboard
    return c.redirect("/app/dashboard");
  });

  return app;
}
