# Heading 1

This paragraph belongs to heading 1.

## Heading 2

This paragraph belongs to heading 2.

### Heading 3

#### Heading 4

##### Heading 5

###### _Heading 6_

# Some **bold** and <u>underlined</u> text with `code` in heading.

This paragraph has **bold** or _italic_ or <u>underlined</u> text.

This paragraph has _**bold-italic**_, _<u>underlined-italic</u>_ and **<u>underlined-bold</u>** text.

This paragraph has `code` and [links](https://www.adobe.com/).

A bold **paragraph with**  
**manual** breaks.

_Trailing space after Italic [link](https://www.adobe.com/)_

Test formatted space. Bold:   Italic:

What happens if **bold spawns**

**several paragraphs?**

This has even more formatting like ~~strikethrough~~ and some<sub>supscript</sub> and<sup>superscript</sup>.

See different monospace fonts: `courier` or `Roboto Mono Bold` or maybe `Source Code Pro`.

Let’s see if spaces after **bold**     are correctly handled. Also **bold**   _italic_  switcherroos. And spaces       **before bold** text?

What about **bold**_**italicbold**italic_ switches?

The **helix-blog-importer** is really awesome!

_Hey,_ _this is italic text._

The _helix-blog-importer_ is indeed awesome!

Here’s some example code:

```
async function getFile(drive, parentId, name, isFolder) {
  const query = [
    `'${parentId}' in parents`,
    `and name = ${JSON.stringify(name)}`,
    'and trashed=false',
    `and mimeType ${isFolder ? '=' : '!='} }
```



And some code with soft breaks



```
       // first, turn styles off that are not in text style
       for (let i = currentStyles.length - 1; i >= 0; i -= 1) {
          const s = currentStyles[i];
          if (!ts[s.name]) {
            md += s.off;
            currentStyles.splice(i, 1);
          }
       }
```

### And a one liner:



`$ npm install`



Should work. And then code `at the end`  
`Before a soft break and at the end`

Of a `paragraph.`

```
Here code with soft breaks and formatting:
$ npm install

$ cd …
And it continues….
Here code with soft breaks only two lines
$ npm install
$ cd …
And it continues….
```

And `code that changes code font`.

Section....

---

Page Break:

---

Section Break (next page):  


Section Break (continous):  


Horizontal Line:

Column Break

---

Empty Heading:



Empty Bold Heading:



Empty heading with image:

![](https://hlx.blob.core.windows.net/external/10ea15e05c418d85e87762fa60afb9942a4d4ca1e#image.png)

Empty heading with hr

Empty heading with section break

  
  


Empty Heading with page break

## Heading withSoft Breaks

## Then numbered lists:

1.  First install the dependencies:  
    $ npm install
2.  Bar **bold**
3.  Trello
    1.  Apple
    2.  Oranges
    3.  Lemons
        1.  Roman
        2.  Greek  
            Muiltiline  
            With code.
        3.  Spanish



## And unordered lists:

-   Todo
-   And so more
-   Should do the trick
    -   Nested 1
    -   Nested 2
-   Mixed with ordered

4.  One
5.  Two
6.  Three

### Special List

7.  `Codeline`
8.  `More code`
9.  `Some more code`

## All List Types

10. One
11. Two
12. Three
1.  Four
1.  Five
13. Six

-   Seven
-   Eight
-   Nine
-   Ten
-   Eleven
-   Twelfe

### Demos

You can watch the entire recording here

14. Server timing & DOM based HTL engine
15. Helix Pages & auto-generated sequence diagrams
16. Performance analysis of Helix OpenWhisk actions
17. Authoring user journey
18. Dev experience: Helix 6 months ago and today

  
  


## Let’s try a simple table



<table>
  <tr>
    <td>a0</td>
    <td>b0</td>
    <td>c0</td>
    <td>d0</td>
  </tr>
  <tr>
    <td>a1</td>
    <td>b1</td>
    <td>c1</td>
    <td>d1</td>
  </tr>
  <tr>
    <td>a2</td>
    <td>b2</td>
    <td>c2</td>
    <td>d2</td>
  </tr>
</table>

## And a more complex table



<table>
  <tr>
    <td><strong>Country</strong></td>
    <td align="center"><strong>Abbrev</strong></td>
    <td align="right"><strong>Amount</strong></td>
    <td><strong>Example</strong></td>
  </tr>
  <tr>
    <td>Switzerland</td>
    <td align="center">CH</td>
    <td align="right">5</td>
    <td>const a=1;<br> let b=5;</td>
  </tr>
  <tr>
    <td>USA</td>
    <td align="center">US</td>
    <td align="right">2.5</td>
    <td><em>n/a -</em> or <img src="https://hlx.blob.core.windows.net/external/10ea15e05c418d85e87762fa60afb9942a4d4ca1e#image.png" alt=""></td>
  </tr>
  <tr>
    <td>Japan</td>
    <td align="center">JP</td>
    <td align="right">3.14</td>
    <td>Math.PI;</td>
  </tr>
</table>

## Table with lists

Totally useless...

<table>
  <tr>
    <td>List</td>
    <td>Comment</td>
  </tr>
  <tr>
    <td><ol> <li>Apple</li> <li>Banana</li> <li>Orange</li> </ol></td>
    <td>fruits</td>
  </tr>
  <tr>
    <td><ul> <li>Car</li> <li>Airplane</li> <li>Ship</li> </ul></td>
    <td>transportation</td>
  </tr>
</table>

# Inline Images

Here is a simple ![Yellow smiley face that looks happy.](https://hlx.blob.core.windows.net/external/10ea15e05c418d85e87762fa60afb9942a4d4ca1e#image.png "Happy Face")happy face!



![Yellow laughing Smiley face.
(not autogenerated!)](https://hlx.blob.core.windows.net/external/10ea15e05c418d85e87762fa60afb9942a4d4ca1e#image.png "Smile")

# This is heading after image

![](https://hlx.blob.core.windows.net/external/10ea15e05c418d85e87762fa60afb9942a4d4ca1e#image.png)

# This is heading with image.

![](https://hlx.blob.core.windows.net/external/10ea15e05c418d85e87762fa60afb9942a4d4ca1e#image.png)



22. ![](https://hlx.blob.core.windows.net/external/10ea15e05c418d85e87762fa60afb9942a4d4ca1e#image.png)
23. ![](https://hlx.blob.core.windows.net/external/10ea15e05c418d85e87762fa60afb9942a4d4ca1e#image.png)

## Final Code

```
/**
 * Main function
 * @param params Action params
 * @returns {Promise<*>} The response
 */
async function run(params) {
  const disclosed = { ...params };
  Object.keys(disclosed).forEach((key) => {
    if (key.match(/^[A-Z0-9_]+$/)) {
      delete disclosed[key];
    }
  });
  log.trace('%s', JSON.stringify(disclosed));


  return fetchViaDoclet(params);
}
```

