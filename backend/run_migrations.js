const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function main() {
    // Check assistants table
    console.log('=== ASSISTANTS TABLE ===');
    const { data: assistants, error: aErr } = await supabase.from('assistants').select('*').limit(20);
    if (aErr) {
        console.log('Error or table not found:', aErr.message);
    } else {
        console.log('Assistants:', JSON.stringify(assistants, null, 2));
    }

    // Check teachers with Thảo
    console.log('\n=== TEACHERS (Thảo) ===');
    const { data: teachers } = await supabase.from('teachers').select('id, full_name, roles').ilike('full_name', '%Thảo%');
    console.log('Teachers:', JSON.stringify(teachers, null, 2));

    // Check lesson_outputs with null assistant_id
    console.log('\n=== LESSON OUTPUTS (no assistant) ===');
    const { data: outputs } = await supabase.from('lesson_outputs').select('id, lesson_name, assistant_id, cost, status').is('assistant_id', null).limit(10);
    console.log('Outputs without assistant:', JSON.stringify(outputs, null, 2));
}

main().catch(console.error);
