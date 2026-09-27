import { MigrationInterface, QueryRunner } from "typeorm";

export class TwoFactor1790517944217 implements MigrationInterface {
    name = 'TwoFactor1790517944217'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "users" ADD "emailVerifiedAt" TIMESTAMP WITH TIME ZONE`);
        await queryRunner.query(`UPDATE "users" SET "emailVerifiedAt" = "createdAt" WHERE "emailVerifiedAt" IS NULL`);
        await queryRunner.query(`ALTER TABLE "users" ADD "twoFactorMethod" character varying`);
        await queryRunner.query(`ALTER TABLE "users" ADD "twoFactorEnabledAt" TIMESTAMP WITH TIME ZONE`);
        await queryRunner.query(`ALTER TABLE "users" ADD "totpSecretEnc" text`);
        await queryRunner.query(`ALTER TABLE "users" ADD "recoveryCodes" jsonb`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "recoveryCodes"`);
        await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "totpSecretEnc"`);
        await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "twoFactorEnabledAt"`);
        await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "twoFactorMethod"`);
        await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "emailVerifiedAt"`);
    }

}
