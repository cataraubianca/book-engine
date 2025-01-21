import { NestFactory, Reflector } from '@nestjs/core';
import { AppModule } from './app.module';
import { SwaggerModule, DocumentBuilder} from '@nestjs/swagger'
import { ValidationPipe } from '@nestjs/common';
//import { atGuards } from './login/common/guards';
import * as cors from 'cors';
async function bootstrap() {
  const app = await NestFactory.create(AppModule, {cors:true});

  app.useGlobalPipes(
    new ValidationPipe({transform:true, forbidUnknownValues: false})
  )

  const reflector = new Reflector();
  //app.useGlobalGuards(new atGuards(reflector));

  const config = new DocumentBuilder()
    .setTitle('Backend')
    .setDescription('Back')
    .setVersion('1.0')
    .addBearerAuth(
     {
       name: 'Authorization',
       bearerFormat: 'JWT',
       scheme: 'bearer',
       type: 'http',
       in: 'Header'
     },
     'docs-token',
    )
    .build()
  const document = SwaggerModule.createDocument(app, config)

  SwaggerModule.setup('docs', app, document);

  app.use(cors());

  await app.listen(3001);

}
bootstrap();