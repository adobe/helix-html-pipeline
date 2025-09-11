# External Images Test

External image with width and height parameters:

![](https://delivery-p12345-e67890.adobeaemcloud.com/adobe/assets/urn:aaid:aem:11112222-1111-2222-1111-222211112222/as/name.avif?assetname=name.jpg&width=800&height=600)

External image with only width parameter:

![](https://delivery-p12345-e67890.adobeaemcloud.com/adobe/assets/urn:aaid:aem:22223333-2222-3333-2222-333322223333/as/hero.avif?assetname=hero.jpg&width=1200)

External image without width/height parameters (should NOT be processed):

![](https://delivery-p12345-e67890.adobeaemcloud.com/adobe/assets/urn:aaid:aem:33334444-3333-4444-3333-444433334444/as/banner.avif?assetname=banner.jpg)

Regular media bus image (should NOT be processed as external image, but converted to picture):

![](https://main--pages--adobe.hlx.live/media_abc123.jpg#width=800&height=600)

Other external image (should be processed as external image):

![](https://delivery-p12345-e67890.adobeaemcloud.com/adobe/assets/urn:aaid:aem:44445555-4444-5555-4444-555544445555/as/logo.avif?assetname=logo.jpg&width=400&height=300)
