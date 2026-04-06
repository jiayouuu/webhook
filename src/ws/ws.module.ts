import { Module } from '@nestjs/common';
import { AuthModule } from '../auth';
import { StompWsService } from './stomp-ws.service';

@Module({
  imports: [AuthModule],
  providers: [StompWsService],
})
export class WsModule {}
