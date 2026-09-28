import { cli, Strategy } from '@jackwener/opencli/registry';

cli({
  site: 'zmt', name: 'douyin-video', access: 'read',
  description: 'Read a Douyin video title and DOM-visible media URL without exporting credentials',
  domain: 'www.douyin.com', browser: true, strategy: Strategy.PUBLIC, navigateBefore: false,
  args: [{ name: 'id', type: 'string', required: true, positional: true }],
  columns: ['title', 'url', 'media', 'duration'],
  func: async (page, args) => {
    if (!/^\d{10,25}$/.test(args.id)) throw new Error('Invalid video ID');
    try { await page.goto(`https://www.douyin.com/video/${args.id}`); }
    catch (error) {
      if (!/Navigation rejected/.test(error.message)) throw error;
      // Bounded recovery for Chromium 152 debugger-detach race: upstream #2487 / #2512.
      await new Promise(resolve => setTimeout(resolve, 600));
      await page.goto(`https://www.douyin.com/video/${args.id}`);
    }
    let streamOnly = false;
    for (let attempt = 0; attempt < 8; attempt++) {
      const result = await page.evaluate(`(() => {
        const video = Array.from(document.querySelectorAll('video')).find(v => v.currentSrc && !v.currentSrc.startsWith('blob:'));
        const title = document.querySelector('h1')?.innerText;
        if (video && title) return { title, url: location.href, media: video.currentSrc, duration: video.duration };
        return { streamOnly: Array.from(document.querySelectorAll('video')).some(v => v.currentSrc.startsWith('blob:')) };
      })()`);
      if (result?.media && result?.title) return [result];
      streamOnly ||= !!result?.streamOnly;
      await page.wait(2);
    }
    if (streamOnly) throw new Error('抖音播放器使用了浏览器视频流，未提供可直接下载的视频地址');
    throw new Error('视频未加载；请在浏览器完成登录或验证后重试');
  },
});
