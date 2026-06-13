const { execSync } = require('child_process');
const query = `const docs = await ctx.db.query("documents").collect(); return docs.map(d => ({ id: d._id, title: d.title, format: d.format }));`;
try {
  const winArgs = query.replace(/"/g, '\\"');
  const output = execSync(`npx convex run --inline-query "${winArgs}"`, { encoding: 'utf-8' });
  console.log(output);
} catch (e) {
  console.error('Error listing documents:', e.message);
}
