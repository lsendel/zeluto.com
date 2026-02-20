import { Hono } from "hono";
import type { Env } from "../index.js";
import {
  SignupView,
  CreateOrgView,
  SelectPlanView,
  SetupView,
} from "../views/onboarding/index";
import { getStaticBaseUrl } from "../utils/static-assets.js";

/**
 * Onboarding routes for the SaaS signup flow
 *
 * Flow:
 * 1. /app/signup → SignupView (Better Auth signup)
 * 2. After signup → /app/onboarding/org → CreateOrgView
 * 3. After org created → /app/onboarding/plan → SelectPlanView
 * 4. After plan selected → /app/onboarding/setup → SetupView
 * 5. After setup complete → POST /api/v1/onboarding/complete → /app/dashboard
 *
 * Each step validates the previous step was completed.
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

    return c.html(<SignupView assetsBaseUrl={getStaticBaseUrl(c.env)} />);
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

    return c.html(<CreateOrgView assetsBaseUrl={getStaticBaseUrl(c.env)} />);
  });

  // Handle organization creation
  app.post("/onboarding/org", async (c) => {
    const user = c.get("user");
    if (!user) {
      return c.redirect("/app/signup");
    }

    const contentType = c.req.header("Content-Type") ?? "";
    let orgName: string | undefined;
    let slug: string | undefined;

    if (contentType.includes("application/json")) {
      const body = (await c.req.json()) as { name?: string; slug?: string };
      orgName = body.name;
      slug = body.slug;
    } else {
      const formData = await c.req.parseBody();
      if (typeof formData?.["name"] === "string") orgName = formData["name"];
      if (typeof formData?.["slug"] === "string") slug = formData["slug"];
    }

    if (!orgName || !slug) {
      return c.json({ error: "NAME_AND_SLUG_REQUIRED" }, 400);
    }

    // Create organization via Identity Worker's onboarding dispatch endpoint
    // (bypasses tenant middleware since user doesn't have an org yet)
    const dispatch = c.env.IDENTITY_DISPATCH ?? c.env.IDENTITY;
    const identityResponse = await dispatch.fetch(
      new Request(
        "https://identity.internal/__dispatch/identity/onboarding/create-org",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Request-Id": c.get("requestId") ?? crypto.randomUUID(),
          },
          body: JSON.stringify({
            name: orgName,
            slug,
            creatorUserId: user.id,
          }),
        },
      ),
    );

    if (!identityResponse.ok) {
      const error = (await identityResponse.json()) as {
        error?: string;
        code?: string;
        message?: string;
      };
      return c.json(
        {
          error: error.code ?? error.error ?? "ORG_CREATION_FAILED",
          message: error.message ?? "Failed to create organization",
        },
        identityResponse.status as 400 | 409 | 500,
      );
    }

    // Return JSON success for HTMX (client-side JS handles redirect)
    return c.json({ success: true, redirect: "/app/onboarding/plan" });
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

    return c.html(<SelectPlanView assetsBaseUrl={getStaticBaseUrl(c.env)} />);
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
      <SetupView
        currentSetupStep={step || "domain"}
        domainVerified={verified}
        assetsBaseUrl={getStaticBaseUrl(c.env)}
      />
    );
  });

  // ========================================
  // API: Create organization (clean path for /api/v1/onboarding/create-org)
  // ========================================
  app.post("/create-org", async (c) => {
    const user = c.get("user");
    if (!user) {
      return c.json({ error: "UNAUTHORIZED" }, 401);
    }

    const contentType = c.req.header("Content-Type") ?? "";
    let orgName: string | undefined;
    let slug: string | undefined;

    if (contentType.includes("application/json")) {
      const body = (await c.req.json()) as { name?: string; slug?: string };
      orgName = body.name;
      slug = body.slug;
    } else {
      const formData = await c.req.parseBody();
      if (typeof formData?.["name"] === "string") orgName = formData["name"];
      if (typeof formData?.["slug"] === "string") slug = formData["slug"];
    }

    if (!orgName || !slug) {
      return c.json({ error: "NAME_AND_SLUG_REQUIRED" }, 400);
    }

    const dispatch = c.env.IDENTITY_DISPATCH ?? c.env.IDENTITY;
    const identityResponse = await dispatch.fetch(
      new Request(
        "https://identity.internal/__dispatch/identity/onboarding/create-org",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Request-Id": c.get("requestId") ?? crypto.randomUUID(),
          },
          body: JSON.stringify({
            name: orgName,
            slug,
            creatorUserId: user.id,
          }),
        },
      ),
    );

    if (!identityResponse.ok) {
      const error = (await identityResponse.json().catch(() => ({}))) as {
        error?: string;
        code?: string;
        message?: string;
      };
      return c.json(
        {
          error: error.code ?? error.error ?? "ORG_CREATION_FAILED",
          message: error.message ?? "Failed to create organization",
        },
        identityResponse.status as 400 | 409 | 500,
      );
    }

    return c.json({ success: true, redirect: "/app/onboarding/plan" });
  });

  // ========================================
  // API: Generate slug (clean path for /api/v1/onboarding/generate-slug)
  // ========================================
  app.get("/generate-slug", (c) => {
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
  // Helper: Generate slug from org name (legacy path)
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
  const handleSelectPlan = async (c: any) => {
    const user = c.get("user");
    const organization = c.get("organization");

    if (!user || !organization) {
      return c.redirect("/app/signup");
    }

    const contentType = c.req.header("Content-Type") ?? "";
    let plan: string | undefined;
    if (contentType.includes("application/json")) {
      const body = (await c.req.json()) as { plan?: string };
      if (typeof body.plan === "string") {
        plan = body.plan;
      }
    } else {
      const formData = await c.req.parseBody();
      const rawPlan = formData?.["plan"];
      if (typeof rawPlan === "string") {
        plan = rawPlan;
      }
    }

    if (!plan) {
      return c.json({ error: "PLAN_REQUIRED" }, 400);
    }

    // For free plan, just update the organization and redirect
    if (plan === "free" && organization?.id && user?.id) {
      // Update organization plan via Identity Worker
      await c.env.IDENTITY.fetch(
        new Request(`https://internal/api/v1/identity/organizations/${organization.id}`, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            "X-User-Id": user.id,
            "X-Request-Id": c.get("requestId") ?? crypto.randomUUID(),
          },
          body: JSON.stringify({ plan: "free" }),
        })
      );

      // Return JSON if api call, otherwise redirect for HTML form
      if (c.req.header("Accept")?.includes("application/json")) {
        return c.json({ success: true, redirect: "/app/onboarding/setup" });
      }
      return c.redirect("/app/onboarding/setup");
    }

    return c.redirect("/app/onboarding/plan");
  };

  app.post("/onboarding/select-plan", handleSelectPlan);
  app.post("/select-plan", handleSelectPlan);

  // ========================================
  // Helper: Skip provider setup
  // ========================================
  const handleSkipProvider = (c: any) => {
    return c.html(
      <SetupView
        currentSetupStep="contacts"
        domainVerified={false}
        isFragment={true}
      />
    );
  };
  app.post("/onboarding/skip-provider", handleSkipProvider);
  app.post("/skip-provider", handleSkipProvider);

  // ========================================
  // Helper: Skip contacts import
  // ========================================
  const handleSkipContacts = (c: any) => {
    return c.html(
      <SetupView
        currentSetupStep="contacts"
        domainVerified={false}
        isFragment={true}
      />
    );
  };
  app.post("/onboarding/skip-contacts", handleSkipContacts);
  app.post("/skip-contacts", handleSkipContacts);

  // ========================================
  // Helper: Skip entire setup
  // ========================================
  const handleSkipSetup = (c: any) => c.redirect("/app/dashboard");
  app.post("/onboarding/skip-setup", handleSkipSetup);
  app.post("/skip-setup", handleSkipSetup);

  // ========================================
  // Complete onboarding
  // ========================================
  const handleCompleteOnboarding = async (c: any) => {
    const user = c.get("user");
    const organization = c.get("organization");

    if (!user) {
      return c.json(
        { error: "UNAUTHORIZED", message: "Authentication required" },
        401,
      );
    }

    if (!organization) {
      return c.json(
        {
          error: "ONBOARDING_INCOMPLETE",
          message: "Organization must be created before completing onboarding",
          nextStep: "/app/onboarding/org",
        },
        400,
      );
    }

    // Validate that a plan has been selected (not still in default/unset state)
    if (!organization.plan) {
      return c.json(
        {
          error: "ONBOARDING_INCOMPLETE",
          message: "A plan must be selected before completing onboarding",
          nextStep: "/app/onboarding/plan",
        },
        400,
      );
    }

    try {
      // Mark onboarding as complete via Identity Worker
      const identityResponse = await c.env.IDENTITY.fetch(
        new Request(
          `https://internal/api/v1/identity/organizations/${organization.id}/onboarding-complete`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "X-User-Id": user.id,
              "X-Request-Id": c.get("requestId") ?? crypto.randomUUID(),
            },
          },
        ),
      );

      if (!identityResponse.ok) {
        c.get("logger")?.warn(
          { status: identityResponse.status },
          "Failed to mark onboarding complete in identity service",
        );
      }

      // If the request expects JSON (API call), return JSON
      const accept = c.req.header("Accept") ?? "";
      if (accept.includes("application/json")) {
        return c.json({
          success: true,
          redirect: "/app/dashboard",
        });
      }

      // Otherwise redirect to dashboard (HTMX / form submission)
      return c.redirect("/app/dashboard");
    } catch (error) {
      c.get("logger")?.error(
        { error: String(error) },
        "Error completing onboarding",
      );

      return c.json(
        { error: "INTERNAL_ERROR", message: "Failed to complete onboarding" },
        500,
      );
    }
  };

  app.post("/onboarding/complete", handleCompleteOnboarding);
  app.post("/complete", handleCompleteOnboarding);

  return app;
}
