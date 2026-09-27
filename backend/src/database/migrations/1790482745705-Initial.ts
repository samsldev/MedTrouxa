import { MigrationInterface, QueryRunner } from "typeorm";

export class Initial1790482745705 implements MigrationInterface {
    name = 'Initial1790482745705'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "users" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "name" character varying NOT NULL, "email" character varying NOT NULL, "passwordHash" character varying NOT NULL, "role" character varying NOT NULL DEFAULT 'student', "university" character varying, "semester" integer, "xp" integer NOT NULL DEFAULT '0', "tokenVersion" integer NOT NULL DEFAULT '0', "termsAcceptedAt" TIMESTAMP WITH TIME ZONE, "termsVersion" character varying, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_a3ffb1c0c8416b9fc6f907b7433" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_97672ac88f789774dd47f7c8be" ON "users" ("email") `);
        await queryRunner.query(`CREATE TABLE "subjects" ("id" SERIAL NOT NULL, "name" character varying NOT NULL, CONSTRAINT "UQ_47a287fe64bd0e1027e603c335c" UNIQUE ("name"), CONSTRAINT "PK_1a023685ac2b051b4e557b0b280" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "topics" ("id" SERIAL NOT NULL, "name" character varying NOT NULL, "subjectId" integer NOT NULL, CONSTRAINT "PK_e4aa99a3fa60ec3a37d1fc4e853" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "questions" ("id" SERIAL NOT NULL, "statement" text NOT NULL, "alternatives" jsonb NOT NULL, "correctKey" character varying NOT NULL, "commentary" text NOT NULL, "topicId" integer NOT NULL, "institution" character varying, "year" integer, "difficulty" character varying NOT NULL DEFAULT 'medium', CONSTRAINT "PK_08a6d4b0f49ff300bf3a0ca60ac" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_e5d76861587b8a6472ec7a26c7" ON "questions" ("topicId") `);
        await queryRunner.query(`CREATE TABLE "answers" ("id" SERIAL NOT NULL, "userId" character varying NOT NULL, "questionId" integer NOT NULL, "chosenKey" character varying NOT NULL, "correct" boolean NOT NULL, "examId" uuid, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_9c32cec6c71e06da0254f2226c6" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_1bd66b7e0599333e61d2e3e167" ON "answers" ("userId") `);
        await queryRunner.query(`CREATE TABLE "decks" ("id" SERIAL NOT NULL, "name" character varying NOT NULL, "description" text, "topicId" integer, "ownerId" uuid, CONSTRAINT "PK_981894e3f8dbe5049ac59cb1af1" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "flashcards" ("id" SERIAL NOT NULL, "deckId" integer NOT NULL, "front" text NOT NULL, "back" text NOT NULL, CONSTRAINT "PK_9acf891ec7aaa7ca05c264ea94d" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_3a8fb45d6c8da92b5c3e2e390c" ON "flashcards" ("deckId") `);
        await queryRunner.query(`CREATE TABLE "card_reviews" ("id" SERIAL NOT NULL, "userId" character varying NOT NULL, "cardId" integer NOT NULL, "ease" double precision NOT NULL DEFAULT '2.5', "interval" integer NOT NULL DEFAULT '0', "repetitions" integer NOT NULL DEFAULT '0', "dueAt" TIMESTAMP WITH TIME ZONE NOT NULL, CONSTRAINT "UQ_834bafe2c7f22bce81306d45f37" UNIQUE ("userId", "cardId"), CONSTRAINT "PK_815ca241f8e694e9cb921b4f08c" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_8b7d92f6daf21009040f143a91" ON "card_reviews" ("userId") `);
        await queryRunner.query(`CREATE INDEX "IDX_93db0cccdb15d508c60a168c47" ON "card_reviews" ("dueAt") `);
        await queryRunner.query(`CREATE TABLE "exams" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "userId" character varying NOT NULL, "title" character varying NOT NULL, "questionIds" jsonb NOT NULL, "durationMinutes" integer NOT NULL, "startedAt" TIMESTAMP NOT NULL DEFAULT now(), "finishedAt" TIMESTAMP WITH TIME ZONE, "score" integer, "answers" jsonb, CONSTRAINT "PK_b43159ee3efa440952794b4f53e" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_5ec7ff70b19e78f3d412addad4" ON "exams" ("userId") `);
        await queryRunner.query(`CREATE TABLE "study_plans" ("id" SERIAL NOT NULL, "title" character varying NOT NULL, "description" text, "goal" character varying NOT NULL, "items" jsonb NOT NULL, CONSTRAINT "PK_0e9610ccbc3b79324da329edb33" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "plan_enrollments" ("id" SERIAL NOT NULL, "userId" character varying NOT NULL, "planId" integer NOT NULL, "completed" jsonb NOT NULL DEFAULT '[]', "rewarded" jsonb NOT NULL DEFAULT '[]', "startedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_c373fbef61ab67caae1b32c1e74" UNIQUE ("userId", "planId"), CONSTRAINT "PK_5b64df8e530730291f642c56176" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "subscriptions" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "userId" character varying NOT NULL, "planId" character varying NOT NULL, "paymentMethod" character varying NOT NULL, "installments" integer NOT NULL, "amount" integer NOT NULL, "status" character varying NOT NULL DEFAULT 'pending', "provider" character varying NOT NULL DEFAULT 'fake', "providerPaymentId" character varying, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "paidAt" TIMESTAMP WITH TIME ZONE, "startsAt" TIMESTAMP WITH TIME ZONE, "expiresAt" TIMESTAMP WITH TIME ZONE, CONSTRAINT "PK_a87248d73155605cf782be9ee5e" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_fbdba4e2ac694cf8c9cecf4dc8" ON "subscriptions" ("userId") `);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_0dfd86b67527aae4d7d51b85df" ON "subscriptions" ("providerPaymentId") WHERE "providerPaymentId" IS NOT NULL`);
        await queryRunner.query(`CREATE TABLE "testimonials" ("id" SERIAL NOT NULL, "name" character varying NOT NULL, "school" character varying, "quote" text NOT NULL, "specialty" character varying, "institutions" character varying, "highlight" character varying, "rating" integer NOT NULL DEFAULT '5', "photoUrl" character varying, "videoUrl" character varying, "featured" boolean NOT NULL DEFAULT false, "approved" boolean NOT NULL DEFAULT true, "published" boolean NOT NULL DEFAULT true, "isDemo" boolean NOT NULL DEFAULT false, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_63b03c608bd258f115a0a4a1060" PRIMARY KEY ("id"))`);
        await queryRunner.query(`ALTER TABLE "topics" ADD CONSTRAINT "FK_38b54068d2482668ba8f81a59ae" FOREIGN KEY ("subjectId") REFERENCES "subjects"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "questions" ADD CONSTRAINT "FK_e5d76861587b8a6472ec7a26c74" FOREIGN KEY ("topicId") REFERENCES "topics"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "answers" ADD CONSTRAINT "FK_c38697a57844f52584abdb878d7" FOREIGN KEY ("questionId") REFERENCES "questions"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "decks" ADD CONSTRAINT "FK_f66800b2d50a8e889dee2464571" FOREIGN KEY ("topicId") REFERENCES "topics"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "flashcards" ADD CONSTRAINT "FK_3a8fb45d6c8da92b5c3e2e390c3" FOREIGN KEY ("deckId") REFERENCES "decks"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "plan_enrollments" ADD CONSTRAINT "FK_3c1126ebb0963480473eef6fd8d" FOREIGN KEY ("planId") REFERENCES "study_plans"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "plan_enrollments" DROP CONSTRAINT "FK_3c1126ebb0963480473eef6fd8d"`);
        await queryRunner.query(`ALTER TABLE "flashcards" DROP CONSTRAINT "FK_3a8fb45d6c8da92b5c3e2e390c3"`);
        await queryRunner.query(`ALTER TABLE "decks" DROP CONSTRAINT "FK_f66800b2d50a8e889dee2464571"`);
        await queryRunner.query(`ALTER TABLE "answers" DROP CONSTRAINT "FK_c38697a57844f52584abdb878d7"`);
        await queryRunner.query(`ALTER TABLE "questions" DROP CONSTRAINT "FK_e5d76861587b8a6472ec7a26c74"`);
        await queryRunner.query(`ALTER TABLE "topics" DROP CONSTRAINT "FK_38b54068d2482668ba8f81a59ae"`);
        await queryRunner.query(`DROP TABLE "testimonials"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_0dfd86b67527aae4d7d51b85df"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_fbdba4e2ac694cf8c9cecf4dc8"`);
        await queryRunner.query(`DROP TABLE "subscriptions"`);
        await queryRunner.query(`DROP TABLE "plan_enrollments"`);
        await queryRunner.query(`DROP TABLE "study_plans"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_5ec7ff70b19e78f3d412addad4"`);
        await queryRunner.query(`DROP TABLE "exams"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_93db0cccdb15d508c60a168c47"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_8b7d92f6daf21009040f143a91"`);
        await queryRunner.query(`DROP TABLE "card_reviews"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_3a8fb45d6c8da92b5c3e2e390c"`);
        await queryRunner.query(`DROP TABLE "flashcards"`);
        await queryRunner.query(`DROP TABLE "decks"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_1bd66b7e0599333e61d2e3e167"`);
        await queryRunner.query(`DROP TABLE "answers"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_e5d76861587b8a6472ec7a26c7"`);
        await queryRunner.query(`DROP TABLE "questions"`);
        await queryRunner.query(`DROP TABLE "topics"`);
        await queryRunner.query(`DROP TABLE "subjects"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_97672ac88f789774dd47f7c8be"`);
        await queryRunner.query(`DROP TABLE "users"`);
    }

}
