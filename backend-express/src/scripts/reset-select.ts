/**
 * Selective Database Reset Script
 * 
 * This script resets specific tables and all their dependent tables (cascade/chain reaction).
 * It automatically discovers foreign key dependencies and resets tables in the correct order.
 */

import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import prisma from '../prisma-client.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
dotenv.config({ path: join(__dirname, '../../.env') });

interface ForeignKey {
  referencing_table: string;
  referencing_column: string;
  referenced_table: string;
  referenced_column: string;
}

interface TableDependency {
  table: string;
  dependsOn: Set<string>;
  referencedBy: Set<string>;
}

class SelectiveReset {
  private dryRun: boolean = false;
  private targetTables: string[] = [];
  private allTables: Set<string> = new Set();
  private dependencies: Map<string, TableDependency> = new Map();

  constructor(args: string[]) {
    // Parse command-line arguments
    if (args.includes('--dry-run')) {
      this.dryRun = true;
      args = args.filter(arg => arg !== '--dry-run');
    }

    if (args.length === 0) {
      console.error('Error: Please specify at least one table name to reset.');
      console.error('Usage: tsx reset-select.ts [--dry-run] <table1> <table2> ...');
      process.exit(1);
    }

    this.targetTables = args.map(table => table.toLowerCase());
  }

  async run(): Promise<void> {
    console.log('🔄 Selective Database Reset Tool\n');
    console.log('='.repeat(60));
    console.log('');

    try {
      // Step 1: Discover all foreign key relationships
      console.log('📋 Discovering foreign key dependencies...');
      const foreignKeys = await this.discoverForeignKeys();
      console.log(`   Found ${foreignKeys.length} foreign key relationships\n`);

      // Step 2: Build dependency graph
      console.log('🔍 Building dependency graph...');
      await this.buildDependencyGraph(foreignKeys);
      console.log(`   Discovered ${this.dependencies.size} tables\n`);

      // Step 3: Find all dependent tables (chain reaction)
      console.log('🔗 Finding dependent tables...');
      const tablesToReset = this.findDependentTables(this.targetTables);
      console.log(`   Tables to reset: ${tablesToReset.length}\n`);

      // Step 4: Topological sort to determine deletion order
      console.log('📊 Determining deletion order...');
      const deletionOrder = this.topologicalSort(tablesToReset);
      console.log(`   Deletion order determined: ${deletionOrder.length} tables\n`);

      // Step 5: Display preview
      this.displayPreview(deletionOrder);

      // Step 6: Confirm execution
      if (this.dryRun) {
        console.log('✅ Dry-run mode: No changes will be made.\n');
        return;
      }

      const confirmed = await this.confirmExecution();
      if (!confirmed) {
        console.log('❌ Operation cancelled.\n');
        return;
      }

      // Step 7: Execute deletions
      console.log('\n🗑️  Executing deletions...\n');
      await this.executeDeletions(deletionOrder);

      // Step 8: Reset sequences
      console.log('\n🔄 Resetting sequences...\n');
      await this.resetSequences(tablesToReset);

      console.log('\n✅ Reset completed successfully!\n');
    } catch (error) {
      console.error('\n❌ Error during reset:', error);
      process.exit(1);
    } finally {
      await prisma.$disconnect();
    }
  }

  private async discoverForeignKeys(): Promise<ForeignKey[]> {
    const query = `
      SELECT 
        tc.table_name AS referencing_table,
        kcu.column_name AS referencing_column,
        ccu.table_name AS referenced_table,
        ccu.column_name AS referenced_column
      FROM information_schema.table_constraints AS tc
      JOIN information_schema.key_column_usage AS kcu
        ON tc.constraint_name = kcu.constraint_name
        AND tc.table_schema = kcu.table_schema
      JOIN information_schema.constraint_column_usage AS ccu
        ON ccu.constraint_name = tc.constraint_name
        AND ccu.table_schema = tc.table_schema
      WHERE tc.constraint_type = 'FOREIGN KEY'
        AND tc.table_schema = 'public'
      ORDER BY tc.table_name, kcu.column_name;
    `;

    const result = await prisma.$queryRawUnsafe<ForeignKey[]>(query);
    return result;
  }

  private async buildDependencyGraph(foreignKeys: ForeignKey[]): Promise<void> {
    // Get all tables from schema
    const tablesQuery = `
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_type = 'BASE TABLE'
      ORDER BY table_name;
    `;
    const tables = await prisma.$queryRawUnsafe<{ table_name: string }[]>(tablesQuery);
    
    tables.forEach(t => {
      const tableName = t.table_name.toLowerCase();
      this.allTables.add(tableName);
      if (!this.dependencies.has(tableName)) {
        this.dependencies.set(tableName, {
          table: tableName,
          dependsOn: new Set(),
          referencedBy: new Set(),
        });
      }
    });

    // Build dependency relationships
    foreignKeys.forEach(fk => {
      const referencing = fk.referencing_table.toLowerCase();
      const referenced = fk.referenced_table.toLowerCase();

      if (this.allTables.has(referencing) && this.allTables.has(referenced)) {
        const refTable = this.dependencies.get(referencing)!;
        const refdTable = this.dependencies.get(referenced)!;

        refTable.dependsOn.add(referenced);
        refdTable.referencedBy.add(referencing);
      }
    });
  }

  private findDependentTables(targetTables: string[]): Set<string> {
    const tablesToReset = new Set<string>();
    const queue = [...targetTables];

    while (queue.length > 0) {
      const table = queue.shift()!.toLowerCase();
      
      if (!this.allTables.has(table)) {
        console.warn(`⚠️  Warning: Table "${table}" not found in database, skipping.`);
        continue;
      }

      if (tablesToReset.has(table)) {
        continue;
      }

      tablesToReset.add(table);

      // Add all tables that reference this table
      const dep = this.dependencies.get(table);
      if (dep) {
        dep.referencedBy.forEach(refTable => {
          if (!tablesToReset.has(refTable)) {
            queue.push(refTable);
          }
        });
      }
    }

    return tablesToReset;
  }

  private topologicalSort(tablesToReset: Set<string>): string[] {
    const inDegree = new Map<string, number>();
    const graph = new Map<string, Set<string>>();
    const result: string[] = [];

    // Initialize in-degree and graph
    tablesToReset.forEach(table => {
      const dep = this.dependencies.get(table);
      if (dep) {
        inDegree.set(table, 0);
        graph.set(table, new Set());
        
        // Count dependencies within the tables to reset
        dep.dependsOn.forEach(parent => {
          if (tablesToReset.has(parent)) {
            const current = inDegree.get(table) || 0;
            inDegree.set(table, current + 1);
            if (!graph.has(parent)) {
              graph.set(parent, new Set());
            }
            graph.get(parent)!.add(table);
          }
        });
      }
    });

    // Topological sort using Kahn's algorithm
    const queue: string[] = [];
    inDegree.forEach((degree, table) => {
      if (degree === 0) {
        queue.push(table);
      }
    });

    while (queue.length > 0) {
      const table = queue.shift()!;
      result.push(table);

      const children = graph.get(table);
      if (children) {
        children.forEach(child => {
          const degree = inDegree.get(child)! - 1;
          inDegree.set(child, degree);
          if (degree === 0) {
            queue.push(child);
          }
        });
      }
    }

    // Reverse to get deletion order (children first)
    return result.reverse();
  }

  private displayPreview(deletionOrder: string[]): void {
    console.log('\n📋 RESET PREVIEW\n');
    console.log('='.repeat(60));
    console.log(`Target tables: ${this.targetTables.join(', ')}`);
    console.log(`Total tables to reset: ${deletionOrder.length}`);
    console.log('\nTables will be deleted in the following order:\n');

    deletionOrder.forEach((table, index) => {
      const isTarget = this.targetTables.includes(table);
      const marker = isTarget ? '🎯' : '  ';
      console.log(`${marker} ${index + 1}. ${table}`);
    });

    console.log('\n' + '='.repeat(60) + '\n');
  }

  private async confirmExecution(): Promise<boolean> {
    // Use readline/promises for async readline (Node.js 17+)
    const readline = await import('readline/promises');
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    try {
      const answer = await rl.question('⚠️  This will permanently delete all data from the above tables. Continue? (yes/no): ');
      return answer.toLowerCase() === 'yes' || answer.toLowerCase() === 'y';
    } finally {
      rl.close();
    }
  }

  private async executeDeletions(deletionOrder: string[]): Promise<void> {
    for (const table of deletionOrder) {
      try {
        console.log(`   Deleting from ${table}...`);
        await prisma.$executeRawUnsafe(`DELETE FROM "${table}";`);
        console.log(`   ✅ ${table} deleted`);
      } catch (error) {
        console.error(`   ❌ Error deleting ${table}:`, error);
        throw error;
      }
    }
  }

  private async resetSequences(tablesToReset: Set<string>): Promise<void> {
    // Get all sequences for the tables to reset
    const sequencesQuery = `
      SELECT sequence_name
      FROM information_schema.sequences
      WHERE sequence_schema = 'public'
        AND sequence_name LIKE '%_seq';
    `;
    const sequences = await prisma.$queryRawUnsafe<{ sequence_name: string }[]>(sequencesQuery);

    for (const seq of sequences) {
      const sequenceName = seq.sequence_name;
      // Extract table name from sequence (e.g., "clients_client_id_seq" -> "clients")
      const tableMatch = sequenceName.match(/^(.+?)_[a-z_]+_seq$/);
      if (tableMatch) {
        const tableName = tableMatch[1].toLowerCase();
        if (tablesToReset.has(tableName)) {
          try {
            console.log(`   Resetting sequence ${sequenceName}...`);
            await prisma.$executeRawUnsafe(`ALTER SEQUENCE "${sequenceName}" RESTART WITH 1;`);
            console.log(`   ✅ ${sequenceName} reset`);
          } catch (error) {
            console.error(`   ❌ Error resetting ${sequenceName}:`, error);
            // Don't throw - sequence reset is less critical
          }
        }
      }
    }
  }
}

// Run the script
const args = process.argv.slice(2);
const reset = new SelectiveReset(args);
reset.run().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});

