import { neon } from '@neondatabase/serverless';

async function seed() {
  const sql = neon(process.env.DATABASE_URL!);

  console.log('Seeding database...\n');

  // Demo organization ID (must exist in identity.organizations)
  const orgId = '00000000-0000-0000-0000-000000000001';
  const contactId1 = '10000000-0000-0000-0000-000000000001';
  const contactId2 = '10000000-0000-0000-0000-000000000002';
  const contactId3 = '10000000-0000-0000-0000-000000000003';

  // ========================================================================
  // Lead Intelligence seed data
  // ========================================================================
  console.log('--- Lead Intelligence ---');

  // Enrichment providers
  await sql`
    INSERT INTO lead_intelligence.enrichment_providers (organization_id, name, type, api_key_encrypted, status, priority, cost_per_lookup, supported_fields, rate_limit)
    VALUES
      (${orgId}, 'Clearbit', 'clearbit', 'enc_demo_clearbit_key', 'active', 1, 0.10, '["email","company","title","phone","linkedin","location"]', 100),
      (${orgId}, 'Apollo', 'apollo', 'enc_demo_apollo_key', 'active', 2, 0.05, '["email","phone","company","title"]', 200),
      (${orgId}, 'Hunter', 'hunter', 'enc_demo_hunter_key', 'active', 3, 0.03, '["email"]', 500)
    ON CONFLICT DO NOTHING
  `;
  console.log('  ✓ Enrichment providers seeded');

  // Waterfall configs
  await sql`
    INSERT INTO lead_intelligence.waterfall_configs (organization_id, name, provider_chain, field_strategy, budget_limit_cents, is_default)
    VALUES
      (${orgId}, 'Default Waterfall', '["clearbit","apollo","hunter"]', '{"email":"first_match","company":"highest_confidence","phone":"first_match"}', 5000, true)
    ON CONFLICT DO NOTHING
  `;
  console.log('  ✓ Waterfall configs seeded');

  // ========================================================================
  // Scoring & Intent seed data
  // ========================================================================
  console.log('\n--- Scoring & Intent ---');

  // Scoring configs (default weights)
  const scoringFactors = [
    { category: 'fit', factor: 'company_size', weight: 15 },
    { category: 'fit', factor: 'industry_match', weight: 15 },
    { category: 'fit', factor: 'job_title_match', weight: 10 },
    { category: 'fit', factor: 'technology_overlap', weight: 10 },
    { category: 'engagement', factor: 'email_opens', weight: 5 },
    { category: 'engagement', factor: 'email_clicks', weight: 10 },
    { category: 'engagement', factor: 'page_visits', weight: 5 },
    { category: 'engagement', factor: 'form_submissions', weight: 15 },
    { category: 'engagement', factor: 'content_downloads', weight: 10 },
    { category: 'intent', factor: 'pricing_page_visit', weight: 20 },
    { category: 'intent', factor: 'demo_request', weight: 30 },
    { category: 'intent', factor: 'free_trial', weight: 25 },
    { category: 'intent', factor: 'competitor_comparison', weight: 15 },
  ];

  for (const f of scoringFactors) {
    await sql`
      INSERT INTO scoring.scoring_configs (organization_id, category, factor, weight)
      VALUES (${orgId}, ${f.category}, ${f.factor}, ${f.weight})
      ON CONFLICT DO NOTHING
    `;
  }
  console.log('  ✓ Scoring configs seeded (13 factors)');

  // Signal configs
  const signalConfigs = [
    { signalType: 'PRICING_PAGE', weight: 20, decayHours: 168, tier: 'high' },
    { signalType: 'DEMO_REQUEST', weight: 30, decayHours: 336, tier: 'critical' },
    { signalType: 'FREE_TRIAL', weight: 25, decayHours: 336, tier: 'critical' },
    { signalType: 'FORM_SUBMIT', weight: 15, decayHours: 168, tier: 'medium' },
    { signalType: 'EMAIL_CLICK', weight: 5, decayHours: 72, tier: 'low' },
    { signalType: 'PAGE_VISIT', weight: 3, decayHours: 48, tier: 'low' },
    { signalType: 'CONTENT_DOWNLOAD', weight: 10, decayHours: 168, tier: 'medium' },
  ];

  for (const s of signalConfigs) {
    await sql`
      INSERT INTO scoring.signal_configs (organization_id, signal_type, weight, decay_hours, tier, enabled)
      VALUES (${orgId}, ${s.signalType}, ${s.weight}, ${s.decayHours}, ${s.tier}, true)
      ON CONFLICT DO NOTHING
    `;
  }
  console.log('  ✓ Signal configs seeded (7 types)');

  // Sample lead scores
  await sql`
    INSERT INTO scoring.lead_scores (organization_id, contact_id, total_score, grade, components, top_contributors)
    VALUES
      (${orgId}, ${contactId1}, 85, 'A', '{"fit":30,"engagement":25,"intent":30}', '[{"factor":"demo_request","points":30},{"factor":"company_size","points":15}]'),
      (${orgId}, ${contactId2}, 55, 'C', '{"fit":20,"engagement":15,"intent":20}', '[{"factor":"pricing_page_visit","points":20},{"factor":"email_clicks","points":10}]'),
      (${orgId}, ${contactId3}, 25, 'D', '{"fit":15,"engagement":10,"intent":0}', '[{"factor":"industry_match","points":15},{"factor":"email_opens","points":5}]')
    ON CONFLICT DO NOTHING
  `;
  console.log('  ✓ Sample lead scores seeded');

  // ========================================================================
  // Revenue Operations seed data
  // ========================================================================
  console.log('\n--- Revenue Operations ---');

  // Sample deals across stages
  const deals = [
    { name: 'Acme Corp Enterprise', stage: 'negotiation', value: 50000, probability: 70 },
    { name: 'TechStart Pro', stage: 'proposal', value: 15000, probability: 50 },
    { name: 'GlobalFin Solutions', stage: 'discovery', value: 80000, probability: 30 },
    { name: 'DataDrive Analytics', stage: 'qualification', value: 25000, probability: 20 },
    { name: 'CloudFirst Inc', stage: 'closed_won', value: 35000, probability: 100 },
    { name: 'RetailMax Pro', stage: 'prospecting', value: 12000, probability: 10 },
  ];

  for (const d of deals) {
    await sql`
      INSERT INTO revops.deals (organization_id, contact_id, name, stage, value, probability, priority)
      VALUES (${orgId}, ${contactId1}, ${d.name}, ${d.stage}, ${d.value}, ${d.probability}, 'medium')
      ON CONFLICT DO NOTHING
    `;
  }
  console.log('  ✓ Sample deals seeded (6 deals)');

  // Routing rules
  await sql`
    INSERT INTO revops.routing_rules (organization_id, name, strategy, conditions, target_reps, priority, enabled)
    VALUES
      (${orgId}, 'Enterprise Leads', 'round_robin', '{"minDealValue":50000}', '["rep-1","rep-2"]', 10, true),
      (${orgId}, 'SMB Leads', 'round_robin', '{"maxDealValue":50000}', '["rep-3","rep-4","rep-5"]', 5, true)
    ON CONFLICT DO NOTHING
  `;
  console.log('  ✓ Routing rules seeded');

  // Sequences
  await sql`
    INSERT INTO revops.sequences (organization_id, name, steps, status)
    VALUES
      (${orgId}, 'Enterprise Outreach', '[{"type":"email","delay_days":0,"subject":"Intro"},{"type":"linkedin","delay_days":2},{"type":"email","delay_days":4,"subject":"Follow-up"},{"type":"call","delay_days":7}]', 'active'),
      (${orgId}, 'SMB Quick Touch', '[{"type":"email","delay_days":0,"subject":"Hello"},{"type":"email","delay_days":3,"subject":"Quick follow-up"}]', 'active')
    ON CONFLICT DO NOTHING
  `;
  console.log('  ✓ Sequences seeded');

  // Workflows
  await sql`
    INSERT INTO revops.workflows (organization_id, name, trigger, conditions, actions, enabled)
    VALUES
      (${orgId}, 'New Deal Notification', 'deal_created', '{}', '[{"type":"send_notification","config":{"channel":"slack","message":"New deal created"}}]', true),
      (${orgId}, 'Stale Deal Alert', 'inactivity', '{"days":14}', '[{"type":"create_task","config":{"title":"Follow up on stale deal"}}]', true)
    ON CONFLICT DO NOTHING
  `;
  console.log('  ✓ Workflows seeded');

  console.log('\nSeeding complete!');
}

seed().catch(console.error);
