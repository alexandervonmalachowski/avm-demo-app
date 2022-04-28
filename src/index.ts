import http from "http";
import net from "net";
import os from "os";

import createApp, { environmentConfig } from "./app";

const main = async () => {
  const config = environmentConfig();
  const app = await createApp(config);
  const server = http.createServer(app);

  await new Promise<void>((res) => {
    server.listen(config.port, res);
  });
  const addr = server.address() as net.AddressInfo;
  console.log(
    [
      `> Starting...`,
      `>   os.version: ${os.version()}`,
      `>   os.hostname: ${os.hostname()}`,
      `>   `,
      `>   CONTAINER_IMAGE=${process.env.CONTAINER_IMAGE}`,
      `>   COMPUTERNAME=${process.env.COMPUTERNAME}`,
      `>   PLATFORM_VERSION=${process.env.PLATFORM_VERSION}`,
      `>   HOSTNAME=${process.env.HOSTNAME}`,
      `>   WEBSITE_SITE_NAME=${process.env.WEBSITE_SITE_NAME}`,
      `>   WEBSITE_HOSTNAME=${process.env.WEBSITE_HOSTNAME}`,
      `> `,
    ].join("\n")
  );
  console.log(`> Ready on http://${addr?.address}:${addr?.port}`);
};

main().catch((err) => {
  console.error(`Failed to create application`);
  console.error(err);
  process.exit(1);
});
