import { Connection } from "@solana/web3.js";
import { BN, Program } from "@coral-xyz/anchor";
import { Pumpfun } from "../program/pumpfun";
import {
  CoinInfoRequest,
  pumpProgramInterface,
  ResultType,
} from "../program/web3";
import { Metaplex } from "@metaplex-foundation/js";
// import { setCoinStatus } from "../routes/coinStatus";

export class AgentsLandListener {
  private metaplex: Metaplex;

  constructor(private readonly connection: Connection) {
    this.metaplex = Metaplex.make(this.connection);
  }

  listenProgramEvents(programId: string) {
    if (!programId) {
      console.error("Program Id is empty");
      return 0;
    }

    const program = new Program(pumpProgramInterface, {
      connection: this.connection as any,
    }) as Program<Pumpfun>;

    // Add an event listener for "launchEvent"
    const launchId = program.addEventListener(
      "launchEvent",
      async (event, _, signature) => {
        console.log("Received launchEvent:", event);
        try {
          const token = await this.metaplex
            .nfts()
            .findByMint(
              { mintAddress: event.mint },
              { commitment: "confirmed" }
            );
          const coinInfo: CoinInfoRequest = {
            creator: event.creator.toBase58(),
            decimals: event.decimals,
            name: token.name,
            ticker: token.symbol,
            description: token.json?.description,
            token: event.mint.toBase58(),
            tx: signature,
            url: token.json?.image || token.uri,
            tokenReserves: event.reserveToken.toNumber(),
            lamportReserves: event.reserveLamport.toNumber(),
          };
          // await createToken(coinInfo);
        } catch (error) {
          logger.error("error storing coin info into the db: ", error);
        }
      }
    );

    const swapId = program.addEventListener(
      "swapEvent",
      async (event, _, signature) => {
        console.log("Received swapEvent:", event);
        try {
          const coinStatusResult: ResultType = {
            tx: signature,
            mint: event.mint.toBase58(),
            user: event.user.toBase58(),
            swapDirection: event.direction,
            lamportAmount:
              event.direction === 0 ? event.amountIn.toNumber() : event.amountOut.toNumber(),
            tokenAmount:
              event.direction === 0 ? event.amountOut.toNumber() : event.amountIn.toNumber(),
            tokenReserves: event.reserveToken.toNumber(),
            lamportReserves: event.reserveLamport.toNumber(),
          };
          // await setCoinStatus(coinStatusResult);
        } catch (error) {
          logger.error("error storing swap tx into the db: ", error);
        }
      }
    );

    console.log("Listener added with ID:", launchId);
  }
}
