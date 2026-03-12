require('dotenv').config();

const path = require('path');

const supabase = require(path.join(__dirname, '..', 'src', 'v2', 'core', 'supabase'));
const platformService = require(path.join(__dirname, '..', 'src', 'v2', 'modules', 'platform', 'platform.service'));

const perPage = Number(process.env.V2_BOOTSTRAP_USERS_PER_PAGE || 100);

const getTenantNameForUser = (user) => {
  const email = String(user?.email || '').trim();
  const base = email ? email.split('@')[0] : String(user?.id || '').slice(0, 8);
  const name = `Workspace ${base}`.trim();
  return name.slice(0, 120) || 'Workspace';
};

const hasMembership = async (userId) => {
  const { count, error } = await supabase
    .from('tenant_memberships')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId);

  if (error) throw error;
  return Number(count || 0) > 0;
};

async function main() {
  if (!supabase) {
    console.error('Supabase v2 client não inicializado. Verifique SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY.');
    process.exit(1);
  }

  let page = 1;
  let scanned = 0;
  let bootstrapped = 0;
  let skipped = 0;
  let hasMore = true;

  while (hasMore) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage });
    if (error) throw error;

    const users = data?.users || [];
    if (!users.length) {
      hasMore = false;
      break;
    }

    for (const user of users) {
      scanned += 1;
      const userId = user.id;

      const alreadyHasMembership = await hasMembership(userId);
      if (alreadyHasMembership) {
        skipped += 1;
        continue;
      }

      const tenantName = getTenantNameForUser(user);
      await platformService.bootstrapTenant(userId, tenantName);
      bootstrapped += 1;
    }

    page += 1;
  }

  console.log(JSON.stringify({ scanned, bootstrapped, skipped }, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
