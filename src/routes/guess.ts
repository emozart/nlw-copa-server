import { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { authenticate } from "../plugins/authenticate";

export async function guessRoutes(fastify: FastifyInstance) {
  fastify.get("/guesses/count", async () => {
    const count = await prisma.guess.count();
    return { count };
  });

  fastify.post(
    "/pools/:poolId/games/:gameId/guesses",
    {
      onRequest: [authenticate],
    },
    async (request, reply) => {
      const createGuessParams = z.object({
        poolId: z.string(),
        gameId: z.string(),
      });

      const createGuessBody = z.object({
        firstTeamScore: z.number(),
        secondTeamScore: z.number(),
      });

      const { poolId, gameId } = createGuessParams.parse(request.params);
      const { firstTeamScore, secondTeamScore } = createGuessBody.parse(
        request.body
      );

      const participant = await prisma.participant.findUnique({
        where: {
          userId_poolId: {
            userId: request.user.sub,
            poolId,
          },
        },
      });

      if (!participant) {
        return reply.status(404).send({ message: "Participant not found" });
      }

      const guess = await prisma.guess.findUnique({
        where: {
          gameId_participantId: {
            gameId,
            participantId: participant.id,
          },
        },
      });

      if (guess) {
        return reply.status(409).send({ message: "Guess already exists" });
      }

      const game = await prisma.game.findUnique({
        where: {
          id: gameId,
        },
      });

      if (!game) {
        return reply.status(404).send({ message: "Game not found" });
      }

      if (game.date < new Date()) {
        return reply.status(409).send({ message: "Game already started" });
      }

      await prisma.guess.create({
        data: {
          firstTeamScore,
          secondTeamScore,
          participantId: participant.id,
          gameId: game.id,
        },
      });

      return reply.status(201).send();
    }
  );
}
