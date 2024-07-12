import { createPool } from '@vercel/postgres';
import { POSTGRES_URL } from '$env/static/private';

const db = createPool({ connectionString: POSTGRES_URL });

export async function load() {
  try {
    const { rows: names } = await db.query('SELECT * FROM names ORDER BY id');
    return { names };
  } catch (error) {
    console.log('Table does not exist, creating and seeding it with dummy data now...');
    await seed();
    const { rows: names } = await db.query('SELECT * FROM names ORDER BY id');
    return { names };
  }
}

async function seed() {
  const client = await db.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS names (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log(`Created "names" table`);

    const users = [
      { name: 'Rohan', email: 'rohan@tcl.com' },
      { name: 'Rebecca', email: 'rebecca@tcl.com' },
      { name: 'Vivek', email: 'vivek@gmail.com' },
    ];

    for (const user of users) {
      await client.query(`
        INSERT INTO names (name, email)
        VALUES ($1, $2)
        ON CONFLICT (email) DO NOTHING;
      `, [user.name, user.email]);
    }
    console.log(`Seeded ${users.length} users`);
  } finally {
    client.release();
  }
}

async function updateUser(user) {
  const client = await db.connect();
  try {
    const result = await client.query(`
      UPDATE names
      SET name = $1, email = $2
      WHERE id = $3
    `, [user.name, user.email, user.id]);
    return { result };
  } catch (error) {
    throw new Error(`Failed to update user: ${error.message}`);
  } finally {
    client.release();
  }
}

/** @type {import('./$types').Actions} */
export const actions = {
  update: async ({ request }) => {
    const req = await request.formData();
    const id = req.get('id');
    const name = req.get('name');
    const email = req.get('email');

    const data = { id, name, email };

    let updateRes = { error: false, email, name, message: '' };

    try {
      const res = await updateUser(data);
      console.log('API request ran successfully');
      updateRes.message = 'User updated successfully';
    } catch (error) {
      console.log('API request errored:', error);
      updateRes.error = true;
      updateRes.message = error.message;
    } finally {
      return updateRes;
    }
  },

  delete: async ({ request }) => {
    const data = await request.formData();
    const client = await db.connect();
    const id = data.get('id');

    try {
      await client.query('DELETE FROM names WHERE id = $1;', [id]);
      return { deleted: true };
    } finally {
      client.release();
    }
  },

  create: async ({ request }) => {
    const data = await request.formData();
    const client = await db.connect();
    const email = data.get('email');
    const name = data.get('name');

    try {
      await client.query(`
        INSERT INTO names (name, email)
        VALUES ($1, $2)
        ON CONFLICT (email) DO NOTHING;
      `, [name, email]);
      return { success: true };
    } finally {
      client.release();
    }
  }
};
