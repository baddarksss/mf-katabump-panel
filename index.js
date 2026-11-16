"use strict";

// Katabump entry for M&F PANEL (vpn-ui v1.9.4).
// Non-root container runner with integrated User Portal (Auth & Subscription Dashboard).
// The stock install.sh needs root, systemd, apt and kernel interfaces.
// This process owns the one public TCP port, starts the panel on an
// internal port, pre-creates every protocol that can actually run here,
// and serves the user authentication and subscription management portal.

const http = require("http");
const https = require("https");
const net = require("net");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const zlib = require("zlib");
const { spawn, spawnSync } = require("child_process");

const VERSION = "mf-panel-katabump-2.0";
const BRAND = "M&F Panel";

const BRAND_FILES = {
  'logo.svg': { type: 'image/svg+xml', b64: 'PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCA0OCA0OCI+CiAgPHJlY3QgeD0iMSIgeT0iMSIgd2lkdGg9IjQ2IiBoZWlnaHQ9IjQ2IiByeD0iMTQiIGZpbGw9IiMwYzEyMWQiIHN0cm9rZT0iIzAwZjBmZiIgc3Ryb2tlLXdpZHRoPSIyIi8+CiAgPHRleHQgeD0iMjQiIHk9IjMwIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBmb250LWZhbWlseT0iQXJpYWwsc2Fucy1zZXJpZiIgZm9udC1zaXplPSIxNCIgZm9udC13ZWlnaHQ9IjcwMCIgbGV0dGVyLXNwYWNpbmc9IjAuNSIgZmlsbD0iIzAwZjBmZiI+TSZhbXA7RjwvdGV4dD4KPC9zdmc+' },
  'theme.css': { type: 'text/css; charset=utf-8', b64: 'LyogTSZGIFBBTkVMIC8gRW1iZXIuIFByZXNlbnRhdGlvbiBvbmx5OyBubyBwcm90b2NvbCBvciBBUEkgY2hhbmdlcy4KICAgTm8gcmVtb3RlIGZvbnRzLCBjYW52YXMsIGJsdXIgZmlsdGVycyBvciBjb250aW51b3VzIGFuaW1hdGlvbi4gKi8KaHRtbFtkYXRhLWFsaXJlemEtdGhlbWU9ImVtYmVyIl0sCmh0bWxbZGF0YS1hbGlyZXphLXRoZW1lPSJlbWJlciJdIGJvZHksCmh0bWxbZGF0YS1hbGlyZXphLXRoZW1lPSJlbWJlciJdW2RhdGEtdGhlbWU9InVsdHJhLWRhcmsiXSBib2R5LmRhcmsgewogIC0tYXAtYmc6IzA4MGIxMjsgLS1hcC1zdXJmYWNlOiMwZjE0MjA7IC0tYXAtcmFpc2VkOiMxNzFlMmQ7CiAgLS1hcC1ib3JkZXI6IzI3MzI0ODsgLS1hcC10ZXh0OiNmNGY3ZmY7IC0tYXAtbXV0ZWQ6IzlkYTliZDsKICAtLWFwLW9yYW5nZTojMDBmMGZmOyAtLWFwLW9yYW5nZS1ob3ZlcjojMzhiZGY4OyAtLWFwLW9yYW5nZS1zb2Z0OnJnYmEoMCwyNDAsMjU1LC4xNCk7CiAgLS1hcC1vbi1vcmFuZ2U6IzAzMTMxYjsgLS1hcC1yaW5nOnJnYmEoMCwyNDAsMjU1LC4yNCk7CiAgLS1iZzp2YXIoLS1hcC1iZyk7IC0tc3VyZmFjZTp2YXIoLS1hcC1zdXJmYWNlKTsgLS1zdXJmYWNlLTI6dmFyKC0tYXAtcmFpc2VkKTsKICAtLWJvcmRlcjp2YXIoLS1hcC1ib3JkZXIpOyAtLWJvcmRlci1zdHJvbmc6IzI4NjE1YTsKICAtLXRleHQ6dmFyKC0tYXAtdGV4dCk7IC0tdGV4dC0yOnZhcigtLWFwLW11dGVkKTsgLS10ZXh0LTM6I2E5YTM5ZDsKICAtLWFjY2VudDp2YXIoLS1hcC1vcmFuZ2UpOyAtLWFjY2VudC1zdHJvbmc6dmFyKC0tYXAtb3JhbmdlKTsKICAtLWFjY2VudC13ZWFrOnZhcigtLWFwLW9yYW5nZS1zb2Z0KTsgLS1vbi1hY2NlbnQ6dmFyKC0tYXAtb24tb3JhbmdlKTsKICAtLWNvbG9yLXByaW1hcnktMTAwOnZhcigtLWFwLW9yYW5nZSk7CiAgLS1yYWRpdXMtc206OHB4OyAtLXJhZGl1cy1tZDoxMnB4OyAtLXJhZGl1cy1sZzoxNnB4OyAtLXJhZGl1cy14bDoyMHB4OwogIC0tZGFyay1jb2xvci1iYWNrZ3JvdW5kOnZhcigtLWFwLWJnKTsKICAtLWRhcmstY29sb3Itc3VyZmFjZS0xMDA6dmFyKC0tYXAtc3VyZmFjZSk7CiAgLS1kYXJrLWNvbG9yLXN1cmZhY2UtMjAwOnZhcigtLWFwLXJhaXNlZCk7CiAgLS1kYXJrLWNvbG9yLXN1cmZhY2UtMzAwOiMzMDMwMzc7IC0tZGFyay1jb2xvci1zdXJmYWNlLTQwMDojMzkzOTQwOwogIC0tZGFyay1jb2xvci1zdXJmYWNlLTUwMDojMzQzNDNjOyAtLWRhcmstY29sb3Itc3VyZmFjZS02MDA6IzNlM2U0NjsKICAtLWRhcmstY29sb3Itc3VyZmFjZS03MDA6IzEzMTMxNjsgLS1kYXJrLWNvbG9yLXN1cmZhY2UtNzAwLXJnYjoxOSwxOSwyMjsKICAtLWRhcmstY29sb3ItdGV4dC1wcmltYXJ5OnZhcigtLWFwLXRleHQpOyAtLWRhcmstY29sb3ItdGV4dC1zZWNvbmRhcnk6dmFyKC0tYXAtbXV0ZWQpOwogIC0tZGFyay1jb2xvci1zdHJva2U6dmFyKC0tYXAtYm9yZGVyKTsgLS1kYXJrLWNvbG9yLXRhYmxlLWhvdmVyOiMyNDIxMjU7CiAgLS1kYXJrLWNvbG9yLXRhYmxlLWhlYWRlci1iZzojMTQxNDE3OyAtLWRhcmstY29sb3ItdGFibGUtYm9keS1iZzp2YXIoLS1hcC1zdXJmYWNlKTsKICAtLWRhcmstY29sb3ItdGFibGUtcm93LXNlbGVjdGVkOiMzNTEwMTg7IC0tZGFyay1jb2xvci10YWJsZS1yb3ctc2VsZWN0ZWQtaG92ZXI6IzRhMTUyMDsKICAtLWRhcmstY29sb3ItdGFibGUtY29sdW1uLXNvcnRlZC1iZzojMjQxMTE2OyAtLWRhcmstY29sb3ItdGFibGUtcmluZzojNTQyMTJhOwogIC0tZGFyay1jb2xvci10YWJsZS1maWx0ZXItZHJvcGRvd24tYmc6dmFyKC0tYXAtcmFpc2VkKTsKICAtLWRhcmstY29sb3ItdGFibGUtcGFnaW5hdGlvbi1zdXJmYWNlOnZhcigtLWFwLXJhaXNlZCk7CiAgLS1kYXJrLWNvbG9yLXNjcm9sbGJhcjojM2IyMDI2OyAtLWRhcmstY29sb3Itc2Nyb2xsYmFyLXdlYmtpdDojN2EyNjM0OwogIC0tZGFyay1jb2xvci1zY3JvbGxiYXItd2Via2l0LWhvdmVyOiNmZjI2M2Y7CiAgLS1kYXJrLWNvbG9yLXNwaW4tY29udGFpbmVyOnZhcigtLWFwLXN1cmZhY2UpOyAtLWRhcmstY29sb3ItdG9vbHRpcDojMzAzMDM3OwogIC0tZGFyay1jb2xvci1jb2RlbWlycm9yLWxpbmUtaG92ZXI6IzM1MjcxZTsKICAtLWRhcmstY29sb3ItY29kZW1pcnJvci1saW5lLXNlbGVjdGlvbjojNGEzNTI2OwogIC8qIE5hdGl2ZSBBZEd1YXJkIGN1c3RvbSBwcm9wZXJ0aWVzLCBpbmNsdWRpbmcgZHJvcGRvd25zIGFuZCBxdWVyeS1sb2cgcm93cy4gKi8KICAtLWJsYWNrOnZhcigtLWFwLXRleHQpOyAtLWJnY29sb3I6dmFyKC0tYXAtYmcpOyAtLW1jb2xvcjp2YXIoLS1hcC10ZXh0KTsKICAtLXNjb2xvcjp2YXIoLS1hcC1tdXRlZCk7IC0tYm9yZGVyLWNvbG9yOnZhcigtLWFwLWJvcmRlcik7CiAgLS1oZWFkZXItYmdjb2xvcjojMTQxNDE2OyAtLWNhcmQtYmdjb2xvcjp2YXIoLS1hcC1zdXJmYWNlKTsKICAtLWNhcmQtYm9yZGVyLWNvbG9yOnZhcigtLWFwLWJvcmRlcik7IC0tY3RybC1iZ2NvbG9yOiMxMTExMTQ7CiAgLS1jdHJsLXNlbGVjdC1iZ2NvbG9yOnZhcigtLWFwLXJhaXNlZCk7IC0tY3RybC1kcm9wZG93bi1jb2xvcjp2YXIoLS1hcC10ZXh0KTsKICAtLWN0cmwtZHJvcGRvd24tYmdjb2xvci1mb2N1czp2YXIoLS1hcC1vcmFuZ2Utc29mdCk7IC0tY3RybC1kcm9wZG93bi1jb2xvci1mb2N1czp2YXIoLS1hcC1vcmFuZ2UpOwogIC0tZm9ybS1kaXNhYmxlZC1iZ2NvbG9yOiMyNDI0Mjk7IC0tZm9ybS1kaXNhYmxlZC1jb2xvcjojYTM5Yzk2OwogIC0tcnQtbm9kYXRhLWJnY29sb3I6dmFyKC0tYXAtc3VyZmFjZSk7IC0tcnQtbm9kYXRhLWNvbG9yOnZhcigtLWFwLW11dGVkKTsKICAtLW1vZGFsLW92ZXJsYXktYmdjb2xvcjpyZ2JhKDAsMCwwLC43KTsgLS1sb2FkaW5nLWJnOnZhcigtLWFwLWJnKTsKICAtLWxvZ3NfX3RhYmxlLWJnY29sb3I6dmFyKC0tYXAtc3VyZmFjZSk7IC0tbG9nc19fcm93LS13aGl0ZS1iZ2NvbG9yOnZhcigtLWFwLXN1cmZhY2UpOwogIC0tbG9nc19fcm93LS1ibHVlLWJnY29sb3I6IzIzMmQzZDsgLS1sb2dzX190ZXh0LWNvbG9yOnZhcigtLWFwLXRleHQpOwogIC0tYWxlcnQtbWVzc2FnZS1jb2xvcjojZmZkY2UxOyAtLWFsZXJ0LW1lc3NhZ2UtYm9yZGVyOiM2MzIwMmM7IC0tYWxlcnQtbWVzc2FnZS1iZzojMjQxMDE2OwogIC0tY2hlY2tib3gtYmc6IzRhNDU0MTsgLS1yYWRpby1iZzojNGE0NTQxOwogIGNvbG9yLXNjaGVtZTpkYXJrOwp9Cg==' },
  'brand.js': { type: 'text/javascript; charset=utf-8', b64: 'LyogTSZGIFBBTkVMIHByZXNlbnRhdGlvbiBhZGFwdGVyLiAqLwooKCkgPT4gewogICd1c2Ugc3RyaWN0JzsKICBjb25zdCBjb25maWcgPSB3aW5kb3cuQUxJUkVaQTsKICBpZiAoIWNvbmZpZykgcmV0dXJuOwogIGNvbnN0IGJhc2UgPSBjb25maWcuYmFzZTsKICBjb25zdCBicmFuZCA9ICdNJkYgUGFuZWwnOwogIGNvbnN0IG5hbWVzID0gL0FkR3VhcmRccypIb21lfFZQTltzLV0/VUl8M1gtVUl8TkZccypQQU5FTC9naTsKICBjb25zdCBpZ25vcmVkID0gJ3NjcmlwdCxzdHlsZSx0ZXh0YXJlYSxpbnB1dCxwcmUsY29kZSxbY29udGVudGVkaXRhYmxlPSJ0cnVlIl0sLmxvZ3NfX3RhYmxlLC5xdWVyeS1sb2csLmFjZV9lZGl0b3InOwogIGNvbnN0IHJlcGxhY2UgPSAodmFsdWUpID0+IHZhbHVlLnJlcGxhY2UobmFtZXMsIGJyYW5kKTsKICBjb25zdCBzZWVuID0gbmV3IFdlYWtTZXQoKTsKICBmdW5jdGlvbiB2aXNpdChyb290KSB7CiAgICBpZiAocm9vdC5ub2RlVHlwZSA9PT0gTm9kZS5URVhUX05PREUpIHsKICAgICAgaWYgKHJvb3QucGFyZW50RWxlbWVudCAmJiAhcm9vdC5wYXJlbnRFbGVtZW50LmNsb3Nlc3QoaWdub3JlZCkpIHsKICAgICAgICBjb25zdCBuZXh0ID0gcmVwbGFjZShyb290Lm5vZGVWYWx1ZSk7CiAgICAgICAgaWYgKG5leHQgIT09IHJvb3Qubm9kZVZhbHVlKSByb290Lm5vZGVWYWx1ZSA9IG5leHQ7CiAgICAgIH0KICAgICAgcmV0dXJuOwogICAgfQogICAgaWYgKHJvb3Qubm9kZVR5cGUgIT09IE5vZGUuRUxFTUVOVF9OT0RFIHx8IHJvb3QubWF0Y2hlcyhpZ25vcmVkKSkgcmV0dXJuOwogICAgZm9yIChjb25zdCBhdHRyIG9mIFsndGl0bGUnLCAnYWx0JywgJ2FyaWEtbGFiZWwnXSkgewogICAgICBpZiAocm9vdC5oYXNBdHRyaWJ1dGUoYXR0cikpIHsKICAgICAgICBjb25zdCBwcmV2aW91cyA9IHJvb3QuZ2V0QXR0cmlidXRlKGF0dHIpLCBuZXh0ID0gcmVwbGFjZShwcmV2aW91cyk7CiAgICAgICAgaWYgKG5leHQgIT09IHByZXZpb3VzKSByb290LnNldEF0dHJpYnV0ZShhdHRyLCBuZXh0KTsKICAgICAgfQogICAgfQogICAgZm9yIChjb25zdCBjaGlsZCBvZiByb290LmNoaWxkTm9kZXMpIHZpc2l0KGNoaWxkKTsKICB9CiAgZnVuY3Rpb24gaWRlbnRpdHkoKSB7CiAgICBjb25zdCB0aXRsZSA9IGJyYW5kICsgKGNvbmZpZy5kbnMgPyAnIMK3IEROUycgOiAnJyk7CiAgICBpZiAoZG9jdW1lbnQudGl0bGUgIT09IHRpdGxlKSBkb2N1bWVudC50aXRsZSA9IHRpdGxlOwogICAgZm9yIChjb25zdCBpY29uIG9mIGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3JBbGwoJ2xpbmtbcmVsfj0iaWNvbiJdJykpIHsKICAgICAgY29uc3QgdGFyZ2V0ID0gYmFzZSArICdfYWxpcmV6YS9sb2dvLnN2Zz92PTEuMS4wJzsKICAgICAgaWYgKGljb24uZ2V0QXR0cmlidXRlKCdocmVmJykgIT09IHRhcmdldCkgaWNvbi5zZXRBdHRyaWJ1dGUoJ2hyZWYnLCB0YXJnZXQpOwogICAgfQogICAgaWYgKCFkb2N1bWVudC5xdWVyeVNlbGVjdG9yKCdsaW5rW3JlbH49Imljb24iXScpKSB7CiAgICAgIGNvbnN0IGxpbmsgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdsaW5rJyk7IGxpbmsucmVsID0gJ2ljb24nOwogICAgICBsaW5rLmhyZWYgPSBiYXNlICsgJ19hbGlyZXphL2xvZ28uc3ZnP3Y9MS4xLjAnOyBkb2N1bWVudC5oZWFkLmFwcGVuZENoaWxkKGxpbmspOwogICAgfQogICAgZm9yIChjb25zdCBsb2dvIG9mIGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3JBbGwoJy5iby1yYWlsLWJyYW5kIGltZywubG9naW4tbG9nbyBpbWcsLmhlYWRlci1icmFuZC1pbWcsaW1nW2FsdD0iYWxpcmV6YXBhbmVsIl0nKSkgewogICAgICBpZiAoc2Vlbi5oYXMobG9nbykpIGNvbnRpbnVlOwogICAgICBzZWVuLmFkZChsb2dvKTsKICAgICAgaWYgKGxvZ28udGFnTmFtZS50b0xvd2VyQ2FzZSgpID09PSAnaW1nJykgewogICAgICAgIGxvZ28uc3JjID0gYmFzZSArICdfYWxpcmV6YS9sb2dvLnN2Zz92PTEuMS4wJzsgbG9nby5hbHQgPSBicmFuZDsKICAgICAgfSBlbHNlIHsKICAgICAgICBsb2dvLnN0eWxlLmRpc3BsYXkgPSAnbm9uZSc7CiAgICAgIH0KICAgICAgY29uc3QgcGFyZW50ID0gbG9nby5wYXJlbnRFbGVtZW50OwogICAgICBpZiAocGFyZW50ICYmICFwYXJlbnQucXVlcnlTZWxlY3RvcignLmFsaXJlemEtbmFtZScpKSB7CiAgICAgICAgY29uc3QgbGFiZWwgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdzcGFuJyk7CiAgICAgICAgbGFiZWwuY2xhc3NOYW1lID0gJ2FsaXJlemEtbmFtZSc7IGxhYmVsLnRleHRDb250ZW50ID0gYnJhbmQ7CiAgICAgICAgcGFyZW50LmFwcGVuZENoaWxkKGxhYmVsKTsKICAgICAgfQogICAgfQogIH0KICBjb25zdCBzdHlsZSA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ3N0eWxlJyk7CiAgc3R5bGUudGV4dENvbnRlbnQgPSAnLmFsaXJlemEtbmFtZXtmb250OjYwMCAxNXB4IHN5c3RlbS11aSxzYW5zLXNlcmlmO2xldHRlci1zcGFjaW5nOi0uNHB4O3doaXRlLXNwYWNlOm5vd3JhcH0nICsKICAgICcuYm8tcmFpbC1icmFuZCBhe2Rpc3BsYXk6ZmxleDthbGlnbi1pdGVtczpjZW50ZXI7Z2FwOjdweDtmbGV4LXdyYXA6d3JhcDtqdXN0aWZ5LWNvbnRlbnQ6Y2VudGVyfScgKwogICAgJy5iby1yYWlsLWJyYW5kIC5hbGlyZXphLW5hbWV7Zm9udC1zaXplOjExcHh9LmJvLXJhaWwtYnJhbmQgaW1ne3dpZHRoOjMwcHg7aGVpZ2h0OjMwcHg7b2JqZWN0LWZpdDpjb250YWlufScgKwogICAgJy5iby1yYWlsLS1jb2xsYXBzZWQgLmFsaXJlemEtbmFtZXtkaXNwbGF5Om5vbmV9JzsKICBkb2N1bWVudC5oZWFkLmFwcGVuZENoaWxkKHN0eWxlKTsKICBsZXQgcGVuZGluZyA9IGZhbHNlOwogIGNvbnN0IG9ic2VydmVyID0gbmV3IE11dGF0aW9uT2JzZXJ2ZXIocmVjb3JkcyA9PiB7CiAgICBmb3IgKGNvbnN0IHJlY29yZCBvZiByZWNvcmRzKSB7CiAgICAgIGlmIChyZWNvcmQudHlwZSA9PT0gJ2NoYXJhY3RlckRhdGEnKSB2aXNpdChyZWNvcmQudGFyZ2V0KTsKICAgICAgZWxzZSBmb3IgKGNvbnN0IG5vZGUgb2YgcmVjb3JkLmFkZGVkTm9kZXMpIHZpc2l0KG5vZGUpOwogICAgfQogICAgaWYgKCFwZW5kaW5nKSB7IHBlbmRpbmcgPSB0cnVlOyByZXF1ZXN0QW5pbWF0aW9uRnJhbWUoKCkgPT4geyBwZW5kaW5nID0gZmFsc2U7IGlkZW50aXR5KCk7IH0pOyB9CiAgfSk7CiAgdmlzaXQoZG9jdW1lbnQuYm9keSk7IGlkZW50aXR5KCk7CiAgb2JzZXJ2ZXIub2JzZXJ2ZShkb2N1bWVudC5kb2N1bWVudEVsZW1lbnQsIHtjaGlsZExpc3Q6IHRydWUsIHN1YnRyZWU6IHRydWUsIGNoYXJhY3RlckRhdGE6IHRydWV9KTsKfSkoKTs=' },
};

const VPN_URL = "https://github.com/Sir-MmD/vpn-ui/releases/download/v1.9.4/vpn-ui-amd64";
const VPN_SHA = "18ec321d9074b319bd5756508bbc523ab5d95450b832c406acdd72e987a2da8f";
const PANEL_PORT = 18080;
const USER_PORT = 18081;
const BASE = "/kb";
const PUBLIC_PORT = Number(process.env.SERVER_PORT || process.env.PORT || 8080);

const ROOT = process.env.KATABUMP_ROOT
  || (fs.existsSync("/home/container") ? "/home/container" : process.cwd());
const VPN_DIR = path.join(ROOT, "vpn");
const BIN = path.join(VPN_DIR, "vpn-ui-amd64");
const MARK = BIN + ".ok";
const DATA = path.join(VPN_DIR, "data");
const BIN_DIR = path.join(VPN_DIR, "bin");
const LOG_DIR = path.join(VPN_DIR, "log");
const ACCESS = path.join(VPN_DIR, "PANEL.txt");
const STATE = path.join(VPN_DIR, "state.json");
const PORTS = {
  vless: 21001,
  trojan: 21002,
  ss: 21003,
  vlessWs: 21011,
  vmessWs: 21012,
  trojanWs: 21013,
  grpc: 21014,
  upgrade: 21015,
};

const PATHS = {
  "/bp-vless": PORTS.vlessWs,
  "/bp-vmess": PORTS.vmessWs,
  "/bp-trojan": PORTS.trojanWs,
  "/bp-up": PORTS.upgrade,
};

// Unique bytes inside vpn-ui v1.9.4 requireRoot, ending at the euid==0 jump.
// Replacing that jump with an unconditional return lets the web panel boot
// without root. It does not grant kernel capabilities.
const PATCH_NEEDLE = Buffer.from("3425f8ffffff48837c2420000f84f4000000", "hex");
const PATCH_JUMP = Buffer.from("e9f500000090", "hex");
const PATCH_EXPECT = Buffer.from("0f84f4000000", "hex");

const state = {
  ready: false,
  status: "در حال شروع",
  note: "",
  publicHost: "",
  child: null,
  stopping: false,
  adminCookie: null,
  sessionSecret: "",
};

function log(line) {
  process.stdout.write("[" + new Date().toISOString() + "] " + line + "\n");
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function ensureDirs() {
  for (const dir of [VPN_DIR, DATA, BIN_DIR, LOG_DIR]) fs.mkdirSync(dir, { recursive: true });
}

function readState() {
  try { return JSON.parse(fs.readFileSync(STATE, "utf8")); } catch (e) { return {}; }
}

function writeState(obj) {
  const next = Object.assign(readState(), obj);
  const tmp = STATE + ".tmp";
  fs.writeFileSync(tmp, JSON.stringify(next, null, 2));
  fs.renameSync(tmp, STATE);
}

function cgroupLimit() {
  const files = ["/sys/fs/cgroup/memory.max", "/sys/fs/cgroup/memory/memory.limit_in_bytes"];
  for (const file of files) {
    try {
      const raw = fs.readFileSync(file, "utf8").trim();
      if (!raw || raw === "max") continue;
      const n = Number(raw);
      if (n > 0 && n < 1e15) return n;
    } catch (e) {}
  }
  return 0;
}

function diskFree(dir) {
  const result = spawnSync("df", ["-B1", dir], { encoding: "utf8", timeout: 8000 });
  if (result.status !== 0 || !result.stdout) return 0;
  const rows = result.stdout.trim().split("\n");
  const cols = rows[rows.length - 1].trim().split(/\s+/);
  return Number(cols[3]) || 0;
}

function sha256(file) {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash("sha256");
    let seen = 0;
    let last = 0;
    fs.createReadStream(file)
      .on("data", (chunk) => {
        hash.update(chunk);
        seen += chunk.length;
        const now = Date.now();
        if (now - last > 8000) {
          last = now;
          state.status = "در حال بررسی فایل، " + Math.floor(seen / (1024 * 1024)) + " مگابایت خوانده شد";
          log(state.status);
        }
      })
      .on("error", reject)
      .on("end", () => resolve(hash.digest("hex")));
  });
}

function hasCurl() {
  const result = spawnSync("curl", ["--version"], { stdio: "ignore" });
  return result.status === 0;
}

function downloadPulse(part, label) {
  const timer = setInterval(() => {
    let size = 0;
    try { size = fs.statSync(part).size; } catch (e) {}
    state.status = label + ": " + Math.floor(size / (1024 * 1024)) + " مگابایت";
    log(state.status);
  }, 8000);
  if (timer.unref) timer.unref();
  return () => clearInterval(timer);
}

function downloadWithCurl(url, dest) {
  return new Promise((resolve, reject) => {
    const part = dest + ".part";
    const stop = downloadPulse(part, "دانلود ادامه دارد");
    const child = spawn("curl", [
      "-fL", "--retry", "8", "--retry-all-errors", "--retry-delay", "3",
      "-C", "-", "--speed-time", "40", "--speed-limit", "2048",
      "-o", part, url,
    ], { stdio: ["ignore", "ignore", "pipe"] });
    let err = "";
    child.stderr.on("data", (buf) => { err += buf.toString("utf8").slice(-500); });
    child.on("error", (e) => { stop(); reject(e); });
    child.on("exit", (code) => {
      stop();
      if (code === 33) {
        try { fs.rmSync(part, { force: true }); } catch (e) {}
        return reject(Object.assign(new Error("resume"), { resume: true }));
      }
      if (code !== 0) return reject(new Error("دانلود ناموفق شد، کد " + code + " " + err.slice(-180)));
      fs.renameSync(part, dest);
      resolve();
    });
  });
}

function downloadWithNode(url, dest, redirects) {
  return new Promise((resolve, reject) => {
    const part = dest + ".part";
    let start = 0;
    try { start = fs.statSync(part).size; } catch (e) {}
    const headers = { "User-Agent": "mf-panel-katabump" };
    if (start > 0) headers.Range = "bytes=" + start + "-";
    const lib = url.startsWith("https:") ? https : http;
    const req = lib.get(url, { headers }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        res.resume();
        if ((redirects || 0) > 8) return reject(new Error("دانلود بیش از حد ریدایرکت شد"));
        const next = new URL(res.headers.location, url).href;
        return resolve(downloadWithNode(next, dest, (redirects || 0) + 1));
      }
      if (res.statusCode === 416) {
        res.resume();
        try { fs.renameSync(part, dest); } catch (e) {}
        return resolve();
      }
      const append = res.statusCode === 206 && start > 0;
      if (res.statusCode !== 200 && !append) {
        res.resume();
        return reject(new Error("دانلود ناموفق شد، HTTP " + res.statusCode));
      }
      if (!append && start > 0) {
        try { fs.rmSync(part, { force: true }); } catch (e) {}
      }
      const out = fs.createWriteStream(part, { flags: append ? "a" : "w" });
      let idle;
      const arm = () => {
        clearTimeout(idle);
        idle = setTimeout(() => req.destroy(new Error("دانلود قطع شد و دوباره ادامه داده می‌شود")), 45000);
      };
      arm();
      res.on("data", () => arm());
      res.pipe(out);
      out.on("error", (err) => { clearTimeout(idle); reject(err); });
      out.on("finish", () => {
        clearTimeout(idle);
        out.close(() => {
          fs.renameSync(part, dest);
          resolve();
        });
      });
    });
    req.on("error", reject);
    req.setTimeout(0);
  });
}

async function download(url, dest) {
  let last;
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      if (hasCurl()) {
        try {
          await downloadWithCurl(url, dest);
        } catch (e) {
          if (!e.resume) throw e;
          await downloadWithCurl(url, dest);
        }
      } else {
        await downloadWithNode(url, dest, 0);
      }
      return;
    } catch (e) {
      last = e;
      log("دانلود قطع شد، از همان‌جا ادامه داده می‌شود: " + e.message);
      await sleep(2000);
    }
  }
  throw last;
}

const GLIBC_DIR = path.join(VPN_DIR, "glibc");
// [url, local name, expected SHA-256]. Hashes match Ubuntu's signed jammy / jammy-updates Packages index.
const GLIBC_DEBS = [
  ["https://archive.ubuntu.com/ubuntu/pool/main/g/glibc/libc6_2.35-0ubuntu3.15_amd64.deb", "libc6.deb",
    "79e35256227e16a607c154cdeb8d76ff12d20e31de286ea7fd9ad3b96fe0452d"],
  ["https://archive.ubuntu.com/ubuntu/pool/main/g/gcc-12/libgcc-s1_12.3.0-1ubuntu1~22.04.3_amd64.deb", "libgcc.deb",
    "d383e642d83263147f7b4b69fb92cf1036e5246c6be3accf10b77f986684589a"],
  ["https://archive.ubuntu.com/ubuntu/pool/main/libx/libxcrypt/libcrypt1_4.4.27-1_amd64.deb", "libcrypt.deb",
    "3fa566e9f861a08736cbc5a97562d9d6e4f0c00450fbeafcb6d7583423b04a98"],
];
const GLIBC_FILES = new Set([
  "ld-linux-x86-64.so.2",
  "libc.so.6",
  "libresolv.so.2",
  "libnss_dns.so.2",
  "libnss_files.so.2",
  "libgcc_s.so.1",
  "libcrypt.so.1",
  "libcrypt.so.1.1.0",
]);

function systemGlibc() {
  const files = ["/lib/x86_64-linux-gnu/libc.so.6", "/lib64/libc.so.6"];
  for (const file of files) {
    if (!fs.existsSync(file)) continue;
    const result = spawnSync(file, [], { encoding: "utf8", timeout: 4000 });
    const text = (result.stdout || "") + (result.stderr || "");
    const match = text.match(/release version (\d+)\.(\d+)/);
    if (match) return { major: Number(match[1]), minor: Number(match[2]) };
  }
  return null;
}

function needsBundledGlibc() {
  const found = systemGlibc();
  if (!found) return true;
  return found.major < 2 || (found.major === 2 && found.minor < 34);
}

function parseAr(buf) {
  if (buf.subarray(0, 8).toString("utf8") !== "!<arch>\n") throw new Error("فایل deb قابل خواندن نیست");
  const files = {};
  let offset = 8;
  while (offset + 60 <= buf.length) {
    const header = buf.subarray(offset, offset + 60).toString("latin1");
    offset += 60;
    const name = header.slice(0, 16).trim().replace(/\/$/, "");
    const size = parseInt(header.slice(48, 58).trim(), 10);
    if (!name || !Number.isFinite(size) || size < 0) break;
    files[name] = buf.subarray(offset, offset + size);
    offset += size + (size % 2);
  }
  return files;
}

function extractNeeded(tar, dest, wanted) {
  const saved = {};
  let offset = 0;
  while (offset + 512 <= tar.length) {
    const header = tar.subarray(offset, offset + 512);
    if (header[0] === 0) break;
    offset += 512;
    const rawName = header.subarray(0, 100).toString("utf8").replace(/\0.*$/, "");
    const prefix = header.subarray(345, 500).toString("utf8").replace(/\0.*$/, "");
    const full = prefix ? prefix + "/" + rawName : rawName;
    const sizeText = header.subarray(124, 136).toString("utf8").replace(/\0.*$/, "").trim();
    const size = parseInt(sizeText, 8) || 0;
    const type = String.fromCharCode(header[156] || 48);
    const chunk = tar.subarray(offset, offset + size);
    offset += Math.ceil(size / 512) * 512;
    const base = full.split("/").pop();
    if (!wanted.has(base)) continue;
    if (type === "2") {
      const linkname = header.subarray(157, 257).toString("utf8").replace(/\0.*$/, "");
      if (linkname.startsWith("/")) continue;
      if (Buffer.isBuffer(saved[base])) continue;
      saved[base] = { link: linkname.split("/").pop() };
    } else if (type === "0" || type === "\0") {
      saved[base] = Buffer.from(chunk);
    }
  }
  fs.mkdirSync(dest, { recursive: true });
  for (const name of Object.keys(saved)) {
    let value = saved[name];
    const seen = new Set();
    while (value && value.link) {
      if (seen.has(value.link)) break;
      seen.add(value.link);
      value = saved[value.link];
    }
    if (!Buffer.isBuffer(value) || value.length === 0) continue;
    const file = path.join(dest, name);
    fs.writeFileSync(file, value);
    fs.chmodSync(file, 0o755);
  }
}

async function ensureRuntime() {
  const loader = path.join(GLIBC_DIR, "ld-linux-x86-64.so.2");
  const mark = path.join(GLIBC_DIR, "ok");
  if (fs.existsSync(loader) && fs.existsSync(path.join(GLIBC_DIR, "libc.so.6")) && fs.existsSync(mark)) {
    state.loader = loader;
    state.libPath = GLIBC_DIR;
    return "cached";
  }
  state.status = "گلیبک کانتینر قدیمی است. کتابخانه سازگار یک بار دانلود می‌شود.";
  log(state.status);
  fs.mkdirSync(GLIBC_DIR, { recursive: true });
  const fzstd = loadFzstd();
  for (const [url, name, expected] of GLIBC_DEBS) {
    const dest = path.join(GLIBC_DIR, name);
    await download(url, dest); // HTTPS only: no plain-HTTP fallback any more
    const got = await sha256(dest);
    if (got !== expected) {
      fs.rmSync(dest, { force: true });
      throw new Error("هش " + name + " با مقدار پین‌شده یکی نیست؛ فایل رد شد.");
    }
    const members = parseAr(fs.readFileSync(dest));
    const packed = members["data.tar.zst"];
    if (!packed) throw new Error("data.tar.zst داخل " + name + " نیست");
    extractNeeded(Buffer.from(fzstd.decompress(packed)), GLIBC_DIR, GLIBC_FILES);
    fs.rmSync(dest, { force: true });
  }
  if (!fs.existsSync(loader) || !fs.existsSync(path.join(GLIBC_DIR, "libc.so.6")) || !fs.existsSync(path.join(GLIBC_DIR, "libresolv.so.2"))) {
    throw new Error("کتابخانه سازگار کامل استخراج نشد");
  }
  fs.writeFileSync(mark, "glibc-2.35\n");
  state.loader = loader;
  state.libPath = GLIBC_DIR;
  return "downloaded";
}

function binLaunch(args) {
  if (state.directExec || !state.loader) return { command: BIN, args: args };
  return {
    command: state.loader,
    args: ["--library-path", state.libPath, BIN].concat(args),
  };
}

const INTERP_OLD = "/lib64/ld-linux-x86-64.so.2";
// dropcache: tiny static x86-64 helper that asks the kernel to drop one file from the page cache.
// Source (assembled with: as + ld -static -nostdlib -z noseparate-code):
//   # dropcache - asks the kernel to drop the page cache of one file.
//   # usage: dropcache <path>   (exit 0 = ok, 1 = failed)
//   # equivalent to: fd = open(argv[1], O_RDONLY); posix_fadvise(fd, 0, 0, POSIX_FADV_DONTNEED);
//   .intel_syntax noprefix
//   .globl _start
//   .text
//   _start:
//       cmp  qword ptr [rsp], 2        # argc >= 2 ?
//       jb   fail
//       mov  rdi, [rsp+16]             # argv[1]
//       xor  esi, esi                  # O_RDONLY
//       mov  eax, 2                    # SYS_open
//       syscall
//       test rax, rax
//       js   fail
//       mov  edi, eax                  # fd
//       xor  esi, esi                  # offset = 0
//       xor  edx, edx                  # len = 0 (to EOF)
//       mov  r10d, 4                   # POSIX_FADV_DONTNEED
//       mov  eax, 221                  # SYS_fadvise64
//       syscall
//       test rax, rax
//       jnz  fail
//       xor  edi, edi
//       jmp  done
//   fail:
//       mov  edi, 1
//   done:
//       mov  eax, 231                  # SYS_exit_group
//       syscall
const FADVISE_B64 = "f0VMRgIBAQAAAAAAAAAAAAIAPgABAAAAeABAAAAAAABAAAAAAAAAANAAAAAAAAAAAAAAAEAAOAABAEAAAwACAAEAAAAFAAAAAAAAAAAAAAAAAEAAAAAAAAAAQAAAAAAAugAAAAAAAAC6AAAAAAAAAAAQAAAAAAAASIM8JAJyL0iLfCQQMfa4AgAAAA8FSIXAeByJxzH2MdJBugQAAAC43QAAAA8FSIXAdQQx/+sFvwEAAAC45wAAAA8FAC5zaHN0cnRhYgAudGV4dAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAALAAAAAQAAAAYAAAAAAAAAeABAAAAAAAB4AAAAAAAAAEIAAAAAAAAAAAAAAAAAAAABAAAAAAAAAAAAAAAAAAAAAQAAAAMAAAAAAAAAAAAAAAAAAAAAAAAAugAAAAAAAAARAAAAAAAAAAAAAAAAAAAAAQAAAAAAAAAAAAAAAAAAAA==";
const FADVISE_SHA = "03a1581761e94d1fe0853d3e0824b2bfca4fa5f783e6befe090198d321509230";

function shortLoaderPath() {
  const dest = path.join(VPN_DIR, "ld.so");
  return Buffer.byteLength(dest) <= INTERP_OLD.length ? dest : "";
}

function linkLoader() {
  const dest = shortLoaderPath();
  const src = path.join(GLIBC_DIR, "ld-linux-x86-64.so.2");
  if (!dest || !fs.existsSync(src)) return "";
  fs.copyFileSync(src, dest);
  fs.chmodSync(dest, 0o755);
  return dest;
}

function patchInterpreter(file, loaderPath) {
  if (Buffer.byteLength(loaderPath) > INTERP_OLD.length) return false;
  const fd = fs.openSync(file, "r+");
  try {
    const buf = Buffer.alloc(65536);
    const n = fs.readSync(fd, buf, 0, buf.length, 0);
    const window = buf.subarray(0, n);
    const have = window.indexOf(loaderPath);
    if (have >= 0) return false;
    const at = window.indexOf(INTERP_OLD);
    if (at < 0) throw new Error("مسیر لودر در باینری پیدا نشد");
    const next = Buffer.alloc(INTERP_OLD.length + 1);
    next.write(loaderPath);
    fs.writeSync(fd, next, 0, next.length, at);
    fs.fsyncSync(fd);
    return true;
  } finally {
    fs.closeSync(fd);
  }
}

function ensureFadvise() {
  const file = path.join(VPN_DIR, "dropcache");
  let ok = false;
  try {
    ok = fs.existsSync(file) && crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex") === FADVISE_SHA;
  } catch (e) {}
  if (!ok) {
    // (re)write when missing or different, so an old/broken copy from a previous version gets replaced
    fs.rmSync(file, { force: true });
    fs.writeFileSync(file, Buffer.from(FADVISE_B64, "base64"));
    fs.chmodSync(file, 0o755);
  }
  return file;
}

function dropFileCache(file) {
  if (!file || !fs.existsSync(file)) return;
  try {
    const r = spawnSync(ensureFadvise(), [file], { timeout: 4000, stdio: "ignore" });
    if ((r.error || r.status !== 0) && !state.dropcacheWarned) {
      state.dropcacheWarned = true;
      log("پاک‌سازی کش فایل انجام نشد (مشکلی نیست، فقط مصرف رم کمی بیشتر می‌شود): " + (r.error ? r.error.message : "کد " + (r.status !== null ? r.status : r.signal)));
    }
  } catch (e) {
    if (!state.dropcacheWarned) {
      state.dropcacheWarned = true;
      log("پاک‌سازی کش فایل انجام نشد: " + e.message);
    }
  }
}

function trimGeo() {
  if (state.trimmed) return;
  state.trimmed = true;
  for (const name of ["geosite_RU.dat", "geoip_RU.dat", "geosite_IR.dat", "geoip_IR.dat"]) {
    try { fs.rmSync(path.join(BIN_DIR, name), { force: true }); } catch (e) {}
  }
  dropFileCache(BIN);
  dropFileCache(path.join(BIN_DIR, "xray-linux-amd64"));
  dropFileCache(path.join(BIN_DIR, "geoip.dat"));
  dropFileCache(path.join(BIN_DIR, "geosite.dat"));
  log("فایل‌های اضافی پاک شد تا دانلود و اجرا روی رم کم گیر نکند.");
}

function findBytes(fd, size, needle) {
  const overlap = needle.length - 1;
  let offset = 0;
  let prev = Buffer.alloc(0);
  while (offset < size) {
    const buf = Buffer.alloc(1024 * 1024);
    const n = fs.readSync(fd, buf, 0, buf.length, offset);
    if (n <= 0) break;
    const window = prev.length ? Buffer.concat([prev, buf.subarray(0, n)]) : buf.subarray(0, n);
    const at = window.indexOf(needle);
    if (at >= 0) return offset - prev.length + at;
    prev = Buffer.from(window.subarray(Math.max(0, window.length - overlap)));
    offset += n;
  }
  return -1;
}

function patchBinary(file) {
  const patchedNeedle = Buffer.concat([PATCH_NEEDLE.subarray(0, PATCH_NEEDLE.length - 6), PATCH_JUMP]);
  const fd = fs.openSync(file, "r+");
  try {
    const size = fs.fstatSync(fd).size;
    if (findBytes(fd, size, patchedNeedle) >= 0) return false;
    const found = findBytes(fd, size, PATCH_NEEDLE);
    if (found < 0) throw new Error("الگوی requireRoot در این نسخه پیدا نشد. فقط v1.9.4 پشتیبانی می‌شود.");
    const jumpAt = found + PATCH_NEEDLE.length - 6;
    const cur = Buffer.alloc(6);
    fs.readSync(fd, cur, 0, 6, jumpAt);
    if (!cur.equals(PATCH_EXPECT)) throw new Error("بایت‌های بررسی روت با نسخه پین‌شده فرق دارد.");
    fs.writeSync(fd, PATCH_JUMP, 0, 6, jumpAt);
    fs.fsyncSync(fd);
    return true;
  } finally {
    fs.closeSync(fd);
  }
}

async function ensureBinary() {
  if (fs.existsSync(BIN)) {
    const hashed = await sha256(BIN);
    const marked = fs.existsSync(MARK) ? fs.readFileSync(MARK, "utf8").trim() : "";
    if (marked && marked === hashed) return "cached";
    if (hashed === VPN_SHA) {
      patchBinary(BIN);
      fs.chmodSync(BIN, 0o755);
      fs.writeFileSync(MARK, await sha256(BIN));
      return "patched";
    }
    try {
      if (patchBinary(BIN) === false) {
        fs.chmodSync(BIN, 0o755);
        fs.writeFileSync(MARK, hashed);
        return "already-patched";
      }
    } catch (e) {
      log("باینری موجود قابل استفاده نیست و دوباره دانلود می‌شود: " + e.message);
    }
  }
  state.status = "در حال دانلود پنل v1.9.4، حدود ۳۳۰ مگابایت. این کار یک بار انجام می‌شود.";
  log(state.status);
  await download(VPN_URL, BIN);
  const got = await sha256(BIN);
  if (got !== VPN_SHA) {
    fs.rmSync(BIN, { force: true });
    throw new Error("هش دانلود با نسخه رسمی یکی نیست");
  }
  patchBinary(BIN);
  fs.chmodSync(BIN, 0o755);
  fs.writeFileSync(MARK, await sha256(BIN));
  return "downloaded";
}

function panelEnv(limit) {
  const env = Object.assign({}, process.env, {
    HOME: ROOT,
    VPNUI_DB_FOLDER: DATA,
    VPNUI_BIN_FOLDER: BIN_DIR,
    VPNUI_LOG_FOLDER: LOG_DIR,
    VPNUI_LOG_LEVEL: "info",
    NO_COLOR: "1",
    GOMAXPROCS: "1",
    GODEBUG: "madvdontneed=1",
  });
  env.MALLOC_ARENA_MAX = "1";
  if (limit >= 768 * 1024 * 1024 && limit < 8 * 1024 * 1024 * 1024) {
    env.GOMEMLIMIT = Math.floor(limit * 0.75 / (1024 * 1024)) + "MiB";
  } else if (limit >= 300 * 1024 * 1024 && limit < 768 * 1024 * 1024) {
    env.GOMEMLIMIT = Math.floor(limit * 0.7 / (1024 * 1024)) + "MiB";
  }
  return env;
}

function runBin(args, env, timeoutMs) {
  return new Promise((resolve) => {
    const launch = binLaunch(args);
    if (state.libPath) env.LD_LIBRARY_PATH = state.libPath;
    const child = spawn(launch.command, launch.args, { cwd: VPN_DIR, env, stdio: ["ignore", "pipe", "pipe"] });
    let out = "";
    let settled = false;
    const finish = (code) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve({ code, out });
    };
    const take = (buf) => {
      out += buf.toString("utf8");
      if (out.length > 20000) out = out.slice(-12000);
    };
    child.stdout.on("data", take);
    child.stderr.on("data", take);
    child.on("error", (err) => {
      out += err.message;
      finish(-1);
    });
    child.on("exit", (code) => finish(code));
    const timer = setTimeout(() => {
      child.kill("SIGKILL");
      out += "\nTIMEOUT";
      finish(-1);
    }, timeoutMs || 90000);
  });
}

function randomPassword() {
  return crypto.randomBytes(9).toString("base64url");
}

function wgKeyPair() {
  const pair = crypto.generateKeyPairSync("x25519");
  const priv = pair.privateKey.export({ type: "pkcs8", format: "der" });
  const pub = pair.publicKey.export({ type: "spki", format: "der" });
  if (priv.length < 32 || pub.length < 32) throw new Error("کلید WireGuard ساخته نشد");
  return {
    secretKey: priv.subarray(priv.length - 32).toString("base64"),
    pubKey: pub.subarray(pub.length - 32).toString("base64"),
  };
}

function isPublicIp(ip) {
  if (!/^\d{1,3}(\.\d{1,3}){3}$/.test(ip)) return false;
  const parts = ip.split(".").map(Number);
  if (parts.some((n) => n > 255)) return false;
  const [a, b] = parts;
  if (a === 0 || a === 10 || a === 127) return false;
  if (a === 192 && b === 168) return false;
  if (a === 172 && b >= 16 && b <= 31) return false;
  if (a === 169 && b === 254) return false;
  if (a === 100 && b >= 64 && b <= 127) return false;
  return true;
}

function publicHostFromEnv() {
  const named = (process.env.PANEL_HOST || "").trim()
    .replace(/^https?:\/\//, "")
    .replace(/\/.*$/, "")
    .replace(/:\d+$/, "");
  if (named) return named;
  const ip = (process.env.SERVER_IP || "").trim();
  if (isPublicIp(ip)) return ip;
  return "";
}

function fetchText(url) {
  return new Promise((resolve) => {
    const lib = url.startsWith("https:") ? https : http;
    const req = lib.get(url, { headers: { "User-Agent": "mf-panel-katabump" }, timeout: 8000 }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        res.resume();
        return resolve(fetchText(new URL(res.headers.location, url).href));
      }
      const chunks = [];
      res.on("data", (c) => chunks.push(c));
      res.on("end", () => resolve(Buffer.concat(chunks).toString("utf8").trim()));
    });
    req.on("error", () => resolve(""));
    req.on("timeout", () => { req.destroy(); resolve(""); });
  });
}

async function detectPublicHost() {
  const known = publicHostFromEnv();
  if (known) return known;
  for (const url of ["https://api.ipify.org", "http://api.ipify.org", "https://icanhazip.com"]) {
    const ip = await fetchText(url);
    if (isPublicIp(ip)) return ip;
  }
  return "";
}

function formBody(fields) {
  return new URLSearchParams(fields).toString();
}

function panelRequest(method, urlPath, { body, cookie } = {}) {
  return new Promise((resolve, reject) => {
    const req = http.request({
      host: "127.0.0.1",
      port: PANEL_PORT,
      method,
      path: urlPath,
      headers: {
        "X-Requested-With": "XMLHttpRequest",
        "Content-Type": "application/x-www-form-urlencoded",
        "Content-Length": Buffer.byteLength(body || ""),
        Cookie: cookie || "",
      },
      timeout: 20000,
    }, (res) => {
      const chunks = [];
      res.on("data", (c) => chunks.push(c));
      res.on("end", () => {
        const jar = [];
        if (cookie) jar.push(cookie);
        for (const row of res.headers["set-cookie"] || []) jar.push(row.split(";")[0]);
        resolve({
          status: res.statusCode,
          body: Buffer.concat(chunks).toString("utf8"),
          cookie: jar.filter(Boolean).join("; "),
        });
      });
    });
    req.on("error", (err) => {
      err.retry = true;
      reject(err);
    });
    req.on("timeout", () => req.destroy(Object.assign(new Error("timeout"), { retry: true })));
    if (body) req.write(body);
    req.end();
  });
}

async function login(username, password) {
  const res = await panelRequest("POST", BASE + "/login", {
    body: formBody({ username, password }),
  });
  let parsed = {};
  try { parsed = JSON.parse(res.body); } catch (e) {}
  if (!parsed.success) {
    const err = new Error("ورود به پنل ناموفق: " + res.body.slice(0, 180));
    err.retry = false;
    throw err;
  }
  return res.cookie;
}

async function loginWhenReady(username, password) {
  let last = new Error("پنل برای ورود آماده نشد");
  for (let i = 0; i < 40; i++) {
    try {
      return await login(username, password);
    } catch (e) {
      last = e;
      if (!e.retry) break;
      await sleep(3000);
    }
  }
  throw last;
}

async function listInbounds(cookie) {
  const res = await panelRequest("GET", BASE + "/panel/api/inbounds/list", { cookie });
  let parsed = {};
  try { parsed = JSON.parse(res.body); } catch (e) {}
  if (!parsed.success) throw new Error("لیست اینباند ناموفق: " + res.body.slice(0, 180));
  return parsed.obj || [];
}

function asText(value) {
  if (value == null) return "";
  return typeof value === "string" ? value : JSON.stringify(value);
}

function proxyField(host) {
  if (!host) return [];
  return [{ forceTls: "none", dest: host, port: PUBLIC_PORT, remark: "" }];
}

function sniff() {
  return JSON.stringify({ enabled: true, destOverride: ["http", "tls", "quic"], metadataOnly: false, routeOnly: false });
}

function stream(network, extra, host) {
  const body = Object.assign({ network: network, security: "none" }, extra || {});
  const proxy = proxyField(host);
  if (proxy.length) body.externalProxy = proxy;
  return JSON.stringify(body);
}

async function addInbound(cookie, spec) {
  const fields = {
    remark: spec.remark,
    enable: "true",
    listen: spec.listen || "127.0.0.1",
    port: String(spec.port),
    protocol: spec.protocol,
    settings: JSON.stringify(spec.settings),
    streamSettings: spec.stream || "{}",
    sniffing: spec.sniffing || sniff(),
    total: "0",
    expiryTime: "0",
  };
  const res = await panelRequest("POST", BASE + "/panel/api/inbounds/add", { cookie, body: formBody(fields) });
  let parsed = {};
  try { parsed = JSON.parse(res.body); } catch (e) {}
  if (!parsed.success) throw new Error(spec.remark + ": " + (parsed.msg || res.body.slice(0, 220)));
  return parsed.obj;
}

function plannedInbounds(host, keys) {
  const ssPassword = crypto.randomBytes(32).toString("base64");
  return [
    {
      remark: "VLESS-TCP",
      port: PORTS.vless,
      protocol: "vless",
      settings: { clients: [], decryption: "none", fallbacks: [{ dest: PORTS.trojan, xver: 0 }] },
      stream: stream("tcp", { tcpSettings: { acceptProxyProtocol: false, header: { type: "none" } } }, host),
    },
    {
      remark: "Trojan-TCP",
      port: PORTS.trojan,
      protocol: "trojan",
      settings: { clients: [], fallbacks: [{ dest: PORTS.ss, xver: 0 }] },
      stream: stream("tcp", { tcpSettings: { acceptProxyProtocol: false, header: { type: "none" } } }, host),
    },
    {
      remark: "Shadowsocks",
      port: PORTS.ss,
      protocol: "shadowsocks",
      settings: { method: "2022-blake3-aes-256-gcm", password: ssPassword, network: "tcp", ivCheck: false, clients: [] },
      stream: stream("tcp", { tcpSettings: { acceptProxyProtocol: false, header: { type: "none" } } }, host),
    },
    {
      remark: "VLESS-WS",
      port: PORTS.vlessWs,
      protocol: "vless",
      settings: { clients: [], decryption: "none" },
      stream: stream("ws", { wsSettings: { path: "/bp-vless", headers: {} } }, host),
    },
    {
      remark: "VMess-WS",
      port: PORTS.vmessWs,
      protocol: "vmess",
      settings: { clients: [] },
      stream: stream("ws", { wsSettings: { path: "/bp-vmess", headers: {} } }, host),
    },
    {
      remark: "Trojan-WS",
      port: PORTS.trojanWs,
      protocol: "trojan",
      settings: { clients: [] },
      stream: stream("ws", { wsSettings: { path: "/bp-trojan", headers: {} } }, host),
    },
    {
      remark: "VLESS-gRPC",
      port: PORTS.grpc,
      protocol: "vless",
      settings: { clients: [], decryption: "none" },
      stream: stream("grpc", { grpcSettings: { serviceName: "bpgrpc", multiMode: false } }, host),
    },
    {
      remark: "VLESS-HTTPUpgrade",
      port: PORTS.upgrade,
      protocol: "vless",
      settings: { clients: [], decryption: "none" },
      stream: stream("httpupgrade", { httpupgradeSettings: { path: "/bp-up", host: "" } }, host),
    },
    {
      remark: "WireGuard",
      listen: "0.0.0.0",
      port: PUBLIC_PORT,
      protocol: "wireguard",
      settings: {
        mtu: 1280,
        secretKey: keys.secretKey,
        pubKey: keys.pubKey,
        noKernelTun: true,
        address: ["10.10.0.1/32"],
        clientNetwork: "10.10.0.0/24",
        clients: [],
        peers: [],
      },
      stream: "{}",
      sniffing: "{}",
    },
  ];
}

function htmlEscape(text) {
  return String(text).replace(/[&<>"]/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[ch]));
}

function writeAccess(info) {
  if (fs.existsSync(ACCESS)) {
    let text = fs.readFileSync(ACCESS, "utf8");
    let changed = false;
    if (info.host && text.includes("IP-سرور")) {
      text = text.split("IP-سرور").join(info.host);
      changed = true;
    }
    if (text.includes("ALIREZAPANEL") || text.includes("NF PANEL")) {
      text = text.split("ALIREZAPANEL").join(BRAND).split("NF PANEL").join(BRAND);
      changed = true;
    }
    const versionLine = "نسخه اجراکننده: " + VERSION;
    if (text.includes("نسخه اجراکننده:") && !text.includes(versionLine)) {
      text = text.replace(/نسخه اجراکننده: .*/, versionLine);
      changed = true;
    }
    if (changed) fs.writeFileSync(ACCESS, text);
    return;
  }
  const lines = [
    BRAND + " روی کاتابامپ",
    "نسخه اجراکننده: " + VERSION,
    "",
    "آدرس پنل مدیریت: http://" + (info.host || "IP-سرور") + ":" + PUBLIC_PORT + BASE + "/",
    "آدرس سرویس ساب: http://" + (info.host || "IP-سرور") + ":" + PUBLIC_PORT + "/",
    "نام کاربری اولیه مدیر: " + info.username,
    "رمز اولیه مدیر: " + info.password,
    "",
    "اگر رمز را داخل پنل عوض کنید، همین فایل عوض نمی‌شود.",
    "کلاینت را در پنل بسازید و لینک ساب را از همان ردیف کپی کنید.",
    "",
    "WireGuard قابل استفاده، اینباند WireGuard است نه WireGuard (C).",
    "اگر هندشیک وصل نشد، UDP پورت " + PUBLIC_PORT + " روی کاتابامپ باز نیست.",
  ];
  fs.writeFileSync(ACCESS, lines.join("\n") + "\n");
}

async function refreshLinks(cookie, host) {
  if (!host) return 0;
  const rows = await listInbounds(cookie);
  const managed = new Set(["VLESS-TCP", "Trojan-TCP", "Shadowsocks", "VLESS-WS", "VMess-WS", "Trojan-WS", "VLESS-gRPC", "VLESS-HTTPUpgrade"]);
  let changed = 0;
  for (const row of rows) {
    if (!managed.has(row.remark)) continue;
    let stream = {};
    try { stream = JSON.parse(asText(row.streamSettings) || "{}"); } catch (e) { stream = {}; }
    const current = Array.isArray(stream.externalProxy) ? (stream.externalProxy[0] || {}) : {};
    if (current.dest === host && Number(current.port) === PUBLIC_PORT && current.forceTls === "none" && !current.remark) continue;
    stream.externalProxy = proxyField(host);
    const fields = {
      id: String(row.id),
      remark: row.remark || "",
      enable: row.enable ? "true" : "false",
      listen: row.listen || "",
      port: String(row.port),
      protocol: row.protocol,
      settings: asText(row.settings) || "{}",
      streamSettings: JSON.stringify(stream),
      sniffing: asText(row.sniffing) || "{}",
      total: String(row.total || 0),
      expiryTime: String(row.expiryTime || 0),
    };
    const res = await panelRequest("POST", BASE + "/panel/api/inbounds/update/" + row.id, {
      cookie,
      body: formBody(fields),
    });
    let parsed = {};
    try { parsed = JSON.parse(res.body); } catch (e) {}
    if (!parsed.success) {
      log("به‌روزرسانی لینک " + row.remark + " ناموفق: " + (parsed.msg || res.body.slice(0, 160)));
      continue;
    }
    changed += 1;
  }
  return changed;
}

async function applyBrand(cookie) {
  return gateway.configure(cookie);
}

async function seed(username, password, host) {
  let cookie;
  try {
    cookie = await loginWhenReady(username, password);
  } catch (e) {
    if (username !== "admin" || password !== "admin") {
      log("ورود با رمز ذخیره‌شده نشد. admin/admin امتحان می‌شود.");
      cookie = await loginWhenReady("admin", "admin");
      username = "admin";
      password = "admin";
      writeState({ username, password, passwordReset: true });
    } else {
      throw e;
    }
  }
  state.adminCookie = cookie;
  const existing = await listInbounds(cookie);
  if (existing.length) {
    log('اینباندهای موجود حفظ شدند؛ ساخت، بازنویسی یا ری‌استارت خودکار انجام نمی‌شود.');
    return { made: existing.map(row => row.remark), skipped: [], username, password };
  }
  const have = new Set(existing.map((row) => row.remark));
  const made = existing.map((row) => row.remark);
  const skipped = [];
  const keys = wgKeyPair();
  for (const spec of plannedInbounds(host, keys)) {
    if (have.has(spec.remark)) continue;
    try {
      await addInbound(cookie, spec);
      made.push(spec.remark);
      log("اینباند ساخته شد: " + spec.remark);
    } catch (e) {
      skipped.push(spec.remark + " (" + e.message + ")");
      log("اینباند ساخته نشد: " + e.message);
    }
  }
  const refreshed = await refreshLinks(cookie, host);
  if (refreshed) log("آدرس لینک‌ها به " + host + " به‌روز شد: " + refreshed);
  writeAccess({ host, username, password });
  // Existing installations may have active clients: configuration/restarts
  // are initiated explicitly by the administrator, never by an update/startup.

  return { made, skipped, username, password };
}


// -------------------------------------------------------------
// TCP Multiplexer & Protocol Splicing (Katabump Engine)
// -------------------------------------------------------------

function looksH2(buf) {
  return buf.length >= 14 && buf.subarray(0, 14).toString("ascii") === "PRI * HTTP/2.0";
}

function httpMethod(buf) {
  const text = buf.subarray(0, Math.min(12, buf.length)).toString("ascii");
  return /^(GET|POST|HEAD|PUT|DELETE|OPTIONS|PATCH|CONNECT) /.test(text);
}

function requestPath(buf) {
  const line = buf.toString("utf8").split(/\r?\n/, 1)[0];
  const match = line.match(/^[A-Z]+ (\S+)/);
  if (!match) return "/";
  return match[1].split("?")[0];
}

function pickPort(buf) {
  if (looksH2(buf)) return PORTS.grpc;
  if (httpMethod(buf)) {
    const reqPath = requestPath(buf);
    for (const prefix of Object.keys(PATHS)) {
      if (reqPath === prefix || reqPath.startsWith(prefix + "/")) return PATHS[prefix];
    }
    if (reqPath.startsWith("/mf/") || reqPath.startsWith("/node/")) return USER_PORT;
    if (reqPath === BASE || reqPath.startsWith(BASE + "/")) {
      return PANEL_PORT;
    }
    return USER_PORT;
  }
  return PORTS.vless;
}

function shouldWait(buf) {
  if (buf.length < 8) return true;
  if (looksH2(buf)) return false;
  if (!httpMethod(buf)) return false;
  if (buf.includes(10)) return false;
  return buf.length < 2048;
}

function splice(socket, port, head) {
  let localPort = 0;
  const up = net.connect({ host: "127.0.0.1", port }, () => {

    if (head.length) up.write(head);
    socket.resume();
    socket.pipe(up);
    up.pipe(socket);
  });
  up.on("close", () => {

  });
  const drop = () => {
    socket.destroy();
    up.destroy();
  };
  up.on("error", drop);
  socket.on("error", drop);
}

function panelBasePath(value) {
  return String(value || "").replace(/^\/+|\/+$/g, "") === "kb";
}

function brandAsset(buf) {
  if (!httpMethod(buf)) return null;
  const reqPath = requestPath(buf);
  const prefix = BASE + "/_alireza/";
  if (reqPath !== prefix.slice(0, -1) && !reqPath.startsWith(prefix)) return null;
  const name = reqPath.slice(prefix.length);
  const file = BRAND_FILES[name];
  if (!file) return Buffer.from("HTTP/1.1 404 Not Found\r\nContent-Length: 0\r\nConnection: close\r\n\r\n");
  const body = Buffer.from(file.b64, "base64");
  return Buffer.concat([
    Buffer.from("HTTP/1.1 200 OK\r\nContent-Type: " + file.type + "\r\nCache-Control: public, max-age=86400\r\nConnection: close\r\nContent-Length: " + body.length + "\r\n\r\n"),
    body,
  ]);
}

function brandHead() {
  const base = BASE + "/";
  return '<script defer src="/mf/admin.js"></script>' + "<link rel=\"stylesheet\" href=\"" + base + "_alireza/theme.css?v=2.4.0\">"
    + "<script>document.documentElement.setAttribute(\"data-alireza-theme\",\"ember\");window.ALIREZA="
    + JSON.stringify({ base: base, dns: false }).replace(/</g, "\\u003c")
    + ";</script><script defer src=\"" + base + "_alireza/brand.js?v=1.1.0\"></script>";
}

function brandHtml(html) {
  let out = String(html).replace(/<title>[^<]*<\/title>/i, "<title>" + BRAND + "</title>");
  out = out.replace(/\[VPN-UI\]/g, BRAND);
  out = out.replace(/<h1 class=\"lgt-title\">Welcome<\/h1>/g, "<h1 class=\"lgt-title\">" + BRAND + "</h1>");
  out = out.split("\\/kb\\/assets/img/logo.png").join("\\/kb\\/_alireza/logo.svg");
  out = out.split("/kb/assets/img/logo.png").join(BASE + "/_alireza/logo.svg");
  if (!out.includes("/_alireza/brand.js")) {
    if (/<\/head>/i.test(out)) out = out.replace(/<\/head>/i, brandHead() + "</head>");
    else out = brandHead() + out;
  }
  return out;
}

function rewriteRequest(req) {
  const end = req.indexOf("\r\n\r\n");
  if (end < 0) return req;
  const header = req.subarray(0, end).toString("latin1")
    .split("\r\n")
    .filter((line) => !/^accept-encoding:/i.test(line) && !/^connection:/i.test(line));
  header.push("Connection: close");
  header.push("Accept-Encoding: identity");
  return Buffer.concat([Buffer.from(header.join("\r\n") + "\r\n\r\n", "latin1"), req.subarray(end + 4)]);
}

function decodeChunked(buf) {
  const out = [];
  let i = 0;
  while (i < buf.length) {
    const nl = buf.indexOf("\r\n", i);
    if (nl < 0) return buf;
    const size = parseInt(buf.subarray(i, nl).toString("ascii"), 16);
    if (!Number.isFinite(size)) return buf;
    if (size === 0) break;
    const start = nl + 2;
    if (start + size > buf.length) return buf;
    out.push(buf.subarray(start, start + size));
    i = start + size + 2;
  }
  return Buffer.concat(out);
}

function collectBody(sock, already, len) {
  return new Promise((resolve, reject) => {
    let buf = already;
    let settled = false;
    const cleanup = () => {
      sock.removeListener("data", onData);
      sock.removeListener("end", onEnd);
      sock.removeListener("error", onErr);
    };
    const finish = (value) => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve(value);
    };
    const onErr = (err) => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(err);
    };
    const onData = (chunk) => {
      buf = Buffer.concat([buf, chunk]);
      if (len != null && buf.length >= len) finish(buf.subarray(0, len));
      else if (buf.length > 1500000) onErr(new Error("html too big"));
    };
    const onEnd = () => finish(len != null ? buf.subarray(0, len) : buf);
    sock.on("data", onData);
    sock.on("end", onEnd);
    sock.on("error", onErr);
    if (len != null && buf.length >= len) finish(buf.subarray(0, len));
  });
}

function forwardPanel(socket, rawReq, port) {
  const target = port || PANEL_PORT;
  const method = rawReq.subarray(0, 8).toString("ascii").split(" ")[0].toUpperCase();
  const req = rewriteRequest(rawReq);
  const up = net.connect({ host: "127.0.0.1", port: target });
  const fail = () => {
    socket.destroy();
    up.destroy();
  };
  let decided = false;
  let headerBuf = Buffer.alloc(0);
  up.on("error", fail);
  socket.on("error", fail);
  up.on("connect", () => up.write(req));
  const passThrough = () => {
    if (!socket.destroyed) socket.write(headerBuf);
    if (up.readableEnded || up.destroyed) {
      if (!socket.destroyed) socket.end();
      return;
    }
    up.pipe(socket);
  };
  up.on("data", function onUp(chunk) {
    if (decided) return;
    headerBuf = Buffer.concat([headerBuf, chunk]);
    const end = headerBuf.indexOf("\r\n\r\n");
    if (end < 0) {
      if (headerBuf.length > 1024 * 1024) {
        decided = true;
        up.removeListener("data", onUp);
        passThrough();
      }
      return;
    }
    decided = true;
    up.removeListener("data", onUp);
    const header = headerBuf.subarray(0, end).toString("latin1");
    const rest = headerBuf.subarray(end + 4);
    const type = (header.match(/content-type:\s*([^\r\n]+)/i) || [])[1] || "";
    const encoding = (header.match(/content-encoding:\s*([^\r\n]+)/i) || [])[1] || "";
    const chunked = /transfer-encoding:\s*chunked/i.test(header);
    const cl = header.match(/content-length:\s*(\d+)/i);
    const len = cl && !chunked ? Number(cl[1]) : null;
    const html = /text\/html/i.test(type) && method !== "HEAD";
    if (!html || (len != null && len > 1500000)) {
      passThrough();
      return;
    }
    collectBody(up, rest, len).then((body) => {
      let plain = chunked ? decodeChunked(body) : body;
      if (/gzip/i.test(encoding)) plain = zlib.gunzipSync(plain);
      else if (/deflate/i.test(encoding)) plain = zlib.inflateSync(plain);
      const branded = Buffer.from(brandHtml(plain.toString("utf8")), "utf8");
      const lines = header.split("\r\n").filter((line) => !/^(content-length|transfer-encoding|content-encoding|connection):/i.test(line));
      lines.push("Content-Length: " + branded.length);
      lines.push("Connection: close");
      if (!socket.destroyed) {
        socket.write(lines.join("\r\n") + "\r\n\r\n");
        socket.end(branded);
      }
      up.destroy();
    }).catch(() => passThrough());
  });
  up.on("end", () => {
    if (!decided && !socket.destroyed) socket.end(headerBuf);
  });
}

function brandProxy(socket, head) {
  let buf = head;
  let settled = false;
  const timer = setTimeout(() => {
    if (settled) return;
    settled = true;
    socket.removeListener("data", onData);
    if (buf.indexOf("\r\n\r\n") < 0) socket.destroy();
    else splice(socket, PANEL_PORT, buf);
  }, 20000);
  const onData = (chunk) => {
    if (chunk.length) buf = Buffer.concat([buf, chunk]);
    if (buf.length > 1024 * 1024) {
      settled = true;
      clearTimeout(timer);
      socket.removeListener("data", onData);
      splice(socket, PANEL_PORT, buf);
      return;
    }
    const end = buf.indexOf("\r\n\r\n");
    if (end < 0) return;
    const header = buf.subarray(0, end).toString("latin1");
    if (/^upgrade:/im.test(header)) {
      settled = true;
      clearTimeout(timer);
      socket.removeListener("data", onData);
      splice(socket, PANEL_PORT, buf);
      return;
    }
    const cl = header.match(/content-length:\s*(\d+)/i);
    const len = cl ? Number(cl[1]) : 0;
    if (/transfer-encoding:\s*chunked/i.test(header) || len > 1024 * 1024) {
      settled = true;
      clearTimeout(timer);
      socket.removeListener("data", onData);
      splice(socket, PANEL_PORT, buf);
      return;
    }
    if (buf.length < end + 4 + len) return;
    settled = true;
    clearTimeout(timer);
    socket.removeListener("data", onData);
    socket.pause();
    forwardPanel(socket, buf.subarray(0, end + 4 + len));
  };
  socket.on("data", onData);
  socket.on("error", () => socket.destroy());
  onData(Buffer.alloc(0));
  if (!settled) socket.resume();
}

function statusPage() {
  const body = "<!doctype html><html lang=\"fa\" dir=\"rtl\"><meta charset=\"utf-8\"><title>" + BRAND + "</title>"
    + "<style>body{margin:0;font-family:Tahoma,sans-serif;background:#090d16;color:#e8fff4}main{max-width:40rem;margin:8vh auto;padding:1.5rem}h1{font-size:1.4rem;color:#00f0ff}</style>"
    + "<main><h1>" + BRAND + " در حال آماده‌سازی است</h1><p>" + htmlEscape(state.status) + "</p>"
    + (state.note ? "<p>" + htmlEscape(state.note) + "</p>" : "")
    + "<p>نسخه " + VERSION + ". این صفحه هر ۸ ثانیه تازه می‌شود.</p></main>"
    + "<script>setTimeout(function(){location.reload()},8000)</script></html>";
  return "HTTP/1.1 200 OK\r\nContent-Type: text/html; charset=utf-8\r\nConnection: close\r\nCache-Control: no-store\r\nContent-Length: "
    + Buffer.byteLength(body) + "\r\n\r\n" + body;
}

function handleSocket(socket) {
  let buf = Buffer.alloc(0);
  let done = false;
  const finish = () => {
    if (done) return;
    done = true;
    clearTimeout(timer);
    socket.removeListener("data", onData);
    const asset = brandAsset(buf);
    if (asset) {
      socket.end(asset);
      return;
    }
    if (!state.ready) {
      if (httpMethod(buf) || buf.length === 0) socket.end(statusPage());
      else socket.destroy();
      return;
    }
    socket.pause();
    const port = pickPort(buf);
    if (port === PANEL_PORT && httpMethod(buf)) {
      brandProxy(socket, buf);
      return;
    }
    splice(socket, port, buf);
  };
  const onData = (chunk) => {
    buf = Buffer.concat([buf, chunk]);
    if (!state.ready) return finish();
    if (!shouldWait(buf) || buf.length >= 4096) finish();
  };
  const timer = setTimeout(finish, 2000);
  socket.on("data", onData);
  socket.on("error", () => socket.destroy());
}

function startPublicServer() {
  const server = net.createServer(handleSocket);
  server.on("error", (err) => {
    log("پورت عمومی باز نشد: " + err.message);
    process.exit(1);
  });
  server.listen(PUBLIC_PORT, "0.0.0.0", () => {
    log("پورت عمومی TCP روی " + PUBLIC_PORT + " باز است. " + VERSION);
  });
  return server;
}

function portOpen(port) {
  return new Promise((resolve) => {
    const socket = net.connect({ host: "127.0.0.1", port }, () => {
      socket.end();
      resolve(true);
    });
    socket.on("error", () => resolve(false));
    socket.setTimeout(1000, () => {
      socket.destroy();
      resolve(false);
    });
  });
}

function startPanel(env) {
  const launch = binLaunch(["run"]);
  if (state.libPath) env.LD_LIBRARY_PATH = state.libPath;
  const child = spawn(launch.command, launch.args, { cwd: VPN_DIR, env, stdio: ["ignore", "pipe", "pipe"] });
  state.child = child;
  const emit = (buf) => {
    const text = buf.toString("utf8");
    process.stdout.write(text);
    if (/extracted bundled geo|Web server running/i.test(text)) trimGeo();
    if (/panel listening/i.test(text)) state.status = "پنل بالا آمد";
  };
  child.stdout.on("data", emit);
  child.stderr.on("data", emit);
  child.on("error", (err) => log("اجرای پنل ناموفق: " + err.message));
  child.on("exit", (code, signal) => {
    state.ready = false;
    state.child = null;
    if (state.stopping) return;
    state.status = "پنل بسته شد (" + (signal || code) + "). کاتابامپ باید ری‌استارت شود.";
    log(state.status);
    process.exit(code || 1);
  });
  return child;
}

function shutdown() {
  state.stopping = true;
  if (state.child && !state.child.killed) state.child.kill("SIGTERM");
  setTimeout(() => process.exit(0), 500).unref();
}
process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
// Safety net: log and keep serving instead of letting one bad request kill the VPN panel.
process.on("unhandledRejection", (err) => {
  log("unhandledRejection: " + (err && err.stack ? err.stack : err));
});
process.on("uncaughtException", (err) => {
  log("uncaughtException: " + (err && err.stack ? err.stack : err));
});

async function waitForPanel() {
  for (let i = 0; i < 90; i++) {
    if (state.child && state.child.exitCode != null) return false;
    if (await portOpen(PANEL_PORT)) return true;
    await sleep(1000);
  }
  return false;
}


// -------------------------------------------------------------
// Self-Tests
// -------------------------------------------------------------

async function runSelfTest() {
  const assert = require('assert');
  assert.equal(pickPort(Buffer.from('GET /kb/ HTTP/1.1\r\n')), PANEL_PORT);
  assert.equal(pickPort(Buffer.from('GET /sub/token HTTP/1.1\r\n')), USER_PORT);
  assert.equal(pickPort(Buffer.from('GET /node/panel/api/inbounds/list HTTP/1.1\r\n')), USER_PORT);
  assert.equal(pickPort(Buffer.from('GET /bp-vless HTTP/1.1\r\n')), PORTS.vlessWs);
  assert.equal(pickPort(Buffer.from('PRI * HTTP/2.0\r\n\r\nSM\r\n\r\n')), PORTS.grpc);
  assert.equal(proxyField('example.com')[0].remark, '');
  log('routing selftest ok');
}

function socketPair() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const port = server.address().port;
      const connected = new Promise((done) => server.once("connection", done));
      const client = net.connect(port, "127.0.0.1");
      client.once("error", reject);
      connected.then((remote) => resolve({
        client,
        remote,
        close() {
          server.close();
          client.destroy();
          remote.destroy();
        },
      }));
    });
  });
}

function readEnded(socket) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    socket.on("data", (chunk) => chunks.push(chunk));
    socket.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    socket.on("error", reject);
  });
}

async function runBrandProxyTest() {
  const mock = http.createServer((req, res) => {
    if (req.url === "/json") {
      res.setHeader("Content-Type", "application/json");
      res.end("{\"ok\":true,\"name\":\"VPN-UI\"}");
      return;
    }
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.end("<html><head><title>9.9.9.9 – Welcome</title></head><body><p>[VPN-UI]</p></body></html>");
  });
  await new Promise((resolve) => mock.listen(0, "127.0.0.1", resolve));
  const port = mock.address().port;
  const htmlPair = await socketPair();
  const htmlDone = readEnded(htmlPair.client);
  forwardPanel(htmlPair.remote, Buffer.from("GET /kb/ HTTP/1.1\r\nHost: x\r\nAccept-Encoding: gzip\r\n\r\n"), port);
  const html = await htmlDone;
  if (!html.includes("<title>" + BRAND + "</title>")) throw new Error("proxied title missing");
  if (!html.includes("/_alireza/brand.js")) throw new Error("proxied script missing");
  if (!html.includes(">" + BRAND + "</p>")) throw new Error("proxied brand missing");
  htmlPair.close();
  await new Promise((resolve) => mock.close(resolve));
  log("brand proxy ok");
}

// -------------------------------------------------------------
// Main Application Entry Point
// -------------------------------------------------------------

const gateway = require('./gateway')({ http, fs, path, crypto, DATA, BASE, PANEL_PORT, USER_PORT, PUBLIC_PORT, panelRequest, formBody, readState, login, log });

async function main() {
  if (!Number.isInteger(PUBLIC_PORT) || PUBLIC_PORT < 1 || PUBLIC_PORT > 65535) {
    log("SERVER_PORT نامعتبر است: " + process.env.SERVER_PORT);
    process.exit(1);
  }
  if (process.arch !== "x64" || process.platform !== "linux") {
    log("این پنل فقط روی لینوکس amd64 اجرا می‌شود. این محیط: " + process.platform + "/" + process.arch);
    process.exit(1);
  }
  ensureDirs();
  startPublicServer();
  gateway.start();

  const limit = cgroupLimit();
  const mb = limit ? Math.floor(limit / (1024 * 1024)) : 0;
  log("حافظه کانتینر: " + (mb ? mb + "MB" : "نامشخص") + ". حالت بیکار این پنل حدود ۳۸۰ مگابایت است.");
  if (mb && mb < 700) {
    state.note = "رم این پلن " + mb + " مگابایت است. فایل‌های اضافی پاک می‌شوند تا پنل گیر نکند. اگر باز هم بسته شد، رم را به ۱ گیگابایت برسانید.";
    log("هشدار: " + state.note);
  }
  state.status = "در حال بررسی دیسک";
  const free = diskFree(ROOT);
  const haveBin = fs.existsSync(BIN);
  const need = haveBin ? 20 * 1024 * 1024 : 420 * 1024 * 1024;
  if (free && free < need) {
    state.status = "دیسک کم است. فایل‌های قدیمی را پاک کنید. حداقل " + Math.ceil(need / (1024 * 1024)) + " مگابایت خالی لازم است.";
    log(state.status);
    return;
  }
  state.status = "در حال آماده کردن فایل پنل";
  const binaryState = await ensureBinary();
  log(binaryState === "downloaded" ? "پنل دانلود و برای کاتابامپ آماده شد." : "باینری آماده است و دوباره دانلود نشد.");
  if (needsBundledGlibc()) {
    const runtime = await ensureRuntime();
    log(runtime === "downloaded" ? "گلیبک سازگار کنار پنل گذاشته شد." : "گلیبک سازگار از قبل موجود است و دوباره دانلود نشد.");
    const linked = linkLoader();
    if (linked) {
      try {
        const changed = patchInterpreter(BIN, linked);
        state.directExec = true;
        log(changed ? "پنل مستقیم اجرا می‌شود تا بعد از دانلود گیر نکند." : "پنل از قبل برای اجرای مستقیم آماده است.");
      } catch (e) {
        state.directExec = false;
        log("اجرای مستقیم نشد: " + e.message);
      }
    }
  }
  dropFileCache(BIN);

  const saved = readState();
  const first = !saved.password;
  let username = saved.username || "admin";
  let password = saved.password || randomPassword();
  const env = panelEnv(limit);
  state.status = "در حال نوشتن تنظیم پنل";
  const settingArgs = ["setting", "-port", String(PANEL_PORT), "-listenIP", "127.0.0.1", "-webBasePath", "kb"];
  if (first) settingArgs.push("-username", username, "-password", password);
  const setting = await runBin(settingArgs, env, 90000);
  if (setting.code !== 0) {
    const detail = setting.out.trim().split(/\r?\n/).filter(Boolean).slice(-4).join(" | ").slice(0, 500);
    state.status = "تنظیم پنل شکست خورد: " + (detail || ("کد " + setting.code));
    log(setting.out.slice(-1500));
    throw new Error(state.status);
  }
  if (first && /Failed to update username and password/i.test(setting.out)) {
    log("رمز تصادفی اعمال نشد. ورود اولیه admin / admin است.");
    username = "admin";
    password = "admin";
  }
  if (first) writeState({ username, password, version: VERSION });
  state.publicHost = await detectPublicHost();
  if (!state.publicHost) {
    log("IP عمومی پیدا نشد. PANEL_HOST را در Environment بگذارید و ری‌استارت کنید، وگرنه لینک‌ها آدرس داخلی می‌گیرند.");
  }
  writeAccess({ host: state.publicHost, username, password });

  state.status = "در حال بالا آوردن پنل";
  startPanel(env);
  const up = await waitForPanel();
  if (!up) throw new Error("پنل روی پورت داخلی بالا نیامد");
  state.ready = true;
  state.status = "پنل باز است";
  log("پنل مدیریت آماده است: http://" + (state.publicHost || "IP-سرور") + ":" + PUBLIC_PORT + BASE + "/");
  log("ساب اصلی پنل: http://" + (state.publicHost || "IP-سرور") + ":" + PUBLIC_PORT + "/");
  if (first) log("مدیر: " + username + "    رمز اولیه: " + password);
  else log("رمز اولیه در vpn/PANEL.txt است. اگر آن را عوض کرده‌اید، همان رمز جدید را بزنید.");
  try {
    const seeded = await seed(username, password, state.publicHost);
    log("اینباندها: " + seeded.made.join("، "));
    if (seeded.skipped.length) log("ساخته نشد: " + seeded.skipped.join(" | "));
  } catch (e) {
    log("تنظیم خودکار اینباند کامل نشد، ولی خود پنل باز است: " + e.message);
  }
  log("WireGuard قابل استفاده اینباند WireGuard است. WireGuard (C)، AmneziaWG، OpenVPN، L2TP، PPTP، IKEv2، SSTP، OpenConnect و GRE در این کانتینر کرنل ندارند و ساخته نمی‌شوند.");
}

if (process.env.SELFTEST === "1") {
  (async () => {
    try {
      await runSelfTest();
      await runBrandProxyTest();
    } catch (err) {
      console.error(err);
      process.exit(1);
    }
  })();
} else {
  main().catch((err) => {
    state.status = "خطا: " + err.message;
    log(state.status);
    setInterval(() => {}, 1000);
  });
}


function loadFzstd() {
  const exports = {};
"use strict";
// Some numerical data is initialized as -1 even when it doesn't need initialization to help the JIT infer types
// aliases for shorter compressed code (most minifers don't do this)
var ab = ArrayBuffer, u8 = Uint8Array, u16 = Uint16Array, i16 = Int16Array, u32 = Uint32Array, i32 = Int32Array;
var slc = function (v, s, e) {
    if (u8.prototype.slice)
        return u8.prototype.slice.call(v, s, e);
    if (s == null || s < 0)
        s = 0;
    if (e == null || e > v.length)
        e = v.length;
    var n = new u8(e - s);
    n.set(v.subarray(s, e));
    return n;
};
var fill = function (v, n, s, e) {
    if (u8.prototype.fill)
        return u8.prototype.fill.call(v, n, s, e);
    if (s == null || s < 0)
        s = 0;
    if (e == null || e > v.length)
        e = v.length;
    for (; s < e; ++s)
        v[s] = n;
    return v;
};
var cpw = function (v, t, s, e) {
    if (u8.prototype.copyWithin)
        return u8.prototype.copyWithin.call(v, t, s, e);
    if (s == null || s < 0)
        s = 0;
    if (e == null || e > v.length)
        e = v.length;
    while (s < e) {
        v[t++] = v[s++];
    }
};
/**
 * Codes for errors generated within this library
 */
exports.ZstdErrorCode = {
    InvalidData: 0,
    WindowSizeTooLarge: 1,
    InvalidBlockType: 2,
    FSEAccuracyTooHigh: 3,
    DistanceTooFarBack: 4,
    UnexpectedEOF: 5
};
// error codes
var ec = [
    'invalid zstd data',
    'window size too large (>2046MB)',
    'invalid block type',
    'FSE accuracy too high',
    'match distance too far back',
    'unexpected EOF'
];
var err = function (ind, msg, nt) {
    var e = new Error(msg || ec[ind]);
    e.code = ind;
    if (Error.captureStackTrace)
        Error.captureStackTrace(e, err);
    if (!nt)
        throw e;
    return e;
};
var rb = function (d, b, n) {
    var i = 0, o = 0;
    for (; i < n; ++i)
        o |= d[b++] << (i << 3);
    return o;
};
var b4 = function (d, b) { return (d[b] | (d[b + 1] << 8) | (d[b + 2] << 16) | (d[b + 3] << 24)) >>> 0; };
// read Zstandard frame header
var rzfh = function (dat, w) {
    var n3 = dat[0] | (dat[1] << 8) | (dat[2] << 16);
    if (n3 == 0x2FB528 && dat[3] == 253) {
        // Zstandard
        var flg = dat[4];
        //    single segment       checksum             dict flag     frame content flag
        var ss = (flg >> 5) & 1, cc = (flg >> 2) & 1, df = flg & 3, fcf = flg >> 6;
        if (flg & 8)
            err(0);
        // byte
        var bt = 6 - ss;
        // dict bytes
        var db = df == 3 ? 4 : df;
        // dictionary id
        var di = rb(dat, bt, db);
        bt += db;
        // frame size bytes
        var fsb = fcf ? (1 << fcf) : ss;
        // frame source size
        var fss = rb(dat, bt, fsb) + ((fcf == 1) && 256);
        // window size
        var ws = fss;
        if (!ss) {
            // window descriptor
            var wb = 1 << (10 + (dat[5] >> 3));
            ws = wb + (wb >> 3) * (dat[5] & 7);
        }
        if (ws > 2145386496)
            err(1);
        var buf = new u8((w == 1 ? (fss || ws) : w ? 0 : ws) + 12);
        buf[0] = 1, buf[4] = 4, buf[8] = 8;
        return {
            b: bt + fsb,
            y: 0,
            l: 0,
            d: di,
            w: (w && w != 1) ? w : buf.subarray(12),
            e: ws,
            o: new i32(buf.buffer, 0, 3),
            u: fss,
            c: cc,
            m: Math.min(131072, ws)
        };
    }
    else if (((n3 >> 4) | (dat[3] << 20)) == 0x184D2A5) {
        // skippable
        return b4(dat, 4) + 8;
    }
    err(0);
};
// most significant bit for nonzero
var msb = function (val) {
    var bits = 0;
    for (; (1 << bits) <= val; ++bits)
        ;
    return bits - 1;
};
// read finite state entropy
var rfse = function (dat, bt, mal) {
    // table pos
    var tpos = (bt << 3) + 4;
    // accuracy log
    var al = (dat[bt] & 15) + 5;
    if (al > mal)
        err(3);
    // size
    var sz = 1 << al;
    // probabilities symbols  repeat   index   high threshold
    var probs = sz, sym = -1, re = -1, i = -1, ht = sz;
    // optimization: single allocation is much faster
    var buf = new ab(512 + (sz << 2));
    var freq = new i16(buf, 0, 256);
    // same view as freq
    var dstate = new u16(buf, 0, 256);
    var nstate = new u16(buf, 512, sz);
    var bb1 = 512 + (sz << 1);
    var syms = new u8(buf, bb1, sz);
    var nbits = new u8(buf, bb1 + sz);
    while (sym < 255 && probs > 0) {
        var bits = msb(probs + 1);
        var cbt = tpos >> 3;
        // mask
        var msk = (1 << (bits + 1)) - 1;
        var val = ((dat[cbt] | (dat[cbt + 1] << 8) | (dat[cbt + 2] << 16)) >> (tpos & 7)) & msk;
        // mask (1 fewer bit)
        var msk1fb = (1 << bits) - 1;
        // max small value
        var msv = msk - probs - 1;
        // small value
        var sval = val & msk1fb;
        if (sval < msv)
            tpos += bits, val = sval;
        else {
            tpos += bits + 1;
            if (val > msk1fb)
                val -= msv;
        }
        freq[++sym] = --val;
        if (val == -1) {
            probs += val;
            syms[--ht] = sym;
        }
        else
            probs -= val;
        if (!val) {
            do {
                // repeat byte
                var rbt = tpos >> 3;
                re = ((dat[rbt] | (dat[rbt + 1] << 8)) >> (tpos & 7)) & 3;
                tpos += 2;
                sym += re;
            } while (re == 3);
        }
    }
    if (sym > 255 || probs)
        err(0);
    var sympos = 0;
    // sym step (coprime with sz - formula from zstd source)
    var sstep = (sz >> 1) + (sz >> 3) + 3;
    // sym mask
    var smask = sz - 1;
    for (var s = 0; s <= sym; ++s) {
        var sf = freq[s];
        if (sf < 1) {
            dstate[s] = -sf;
            continue;
        }
        // This is split into two loops in zstd to avoid branching, but as JS is higher-level that is unnecessary
        for (i = 0; i < sf; ++i) {
            syms[sympos] = s;
            do {
                sympos = (sympos + sstep) & smask;
            } while (sympos >= ht);
        }
    }
    // After spreading symbols, should be zero again
    if (sympos)
        err(0);
    for (i = 0; i < sz; ++i) {
        // next state
        var ns = dstate[syms[i]]++;
        // num bits
        var nb = nbits[i] = al - msb(ns);
        nstate[i] = (ns << nb) - sz;
    }
    return [(tpos + 7) >> 3, {
            b: al,
            s: syms,
            n: nbits,
            t: nstate
        }];
};
// read huffman
var rhu = function (dat, bt) {
    //  index  weight count
    var i = 0, wc = -1;
    //    buffer             header byte
    var buf = new u8(292), hb = dat[bt];
    // huffman weights
    var hw = buf.subarray(0, 256);
    // rank count
    var rc = buf.subarray(256, 268);
    // rank index
    var ri = new u16(buf.buffer, 268);
    // NOTE: at this point bt is 1 less than expected
    if (hb < 128) {
        // end byte, fse decode table
        var _a = rfse(dat, bt + 1, 6), ebt = _a[0], fdt = _a[1];
        bt += hb;
        var epos = ebt << 3;
        // last byte
        var lb = dat[bt];
        if (!lb)
            err(0);
        //  state1   state2   state1 bits   state2 bits
        var st1 = 0, st2 = 0, btr1 = fdt.b, btr2 = btr1;
        // fse pos
        // pre-increment to account for original deficit of 1
        var fpos = (++bt << 3) - 8 + msb(lb);
        for (;;) {
            fpos -= btr1;
            if (fpos < epos)
                break;
            var cbt = fpos >> 3;
            st1 += ((dat[cbt] | (dat[cbt + 1] << 8)) >> (fpos & 7)) & ((1 << btr1) - 1);
            hw[++wc] = fdt.s[st1];
            fpos -= btr2;
            if (fpos < epos)
                break;
            cbt = fpos >> 3;
            st2 += ((dat[cbt] | (dat[cbt + 1] << 8)) >> (fpos & 7)) & ((1 << btr2) - 1);
            hw[++wc] = fdt.s[st2];
            btr1 = fdt.n[st1];
            st1 = fdt.t[st1];
            btr2 = fdt.n[st2];
            st2 = fdt.t[st2];
        }
        if (++wc > 255)
            err(0);
    }
    else {
        wc = hb - 127;
        for (; i < wc; i += 2) {
            var byte = dat[++bt];
            hw[i] = byte >> 4;
            hw[i + 1] = byte & 15;
        }
        ++bt;
    }
    // weight exponential sum
    var wes = 0;
    for (i = 0; i < wc; ++i) {
        var wt = hw[i];
        // bits must be at most 11, same as weight
        if (wt > 11)
            err(0);
        wes += wt && (1 << (wt - 1));
    }
    // max bits
    var mb = msb(wes) + 1;
    // table size
    var ts = 1 << mb;
    // remaining sum
    var rem = ts - wes;
    // must be power of 2
    if (rem & (rem - 1))
        err(0);
    hw[wc++] = msb(rem) + 1;
    for (i = 0; i < wc; ++i) {
        var wt = hw[i];
        ++rc[hw[i] = wt && (mb + 1 - wt)];
    }
    // huf buf
    var hbuf = new u8(ts << 1);
    //    symbols                      num bits
    var syms = hbuf.subarray(0, ts), nb = hbuf.subarray(ts);
    ri[mb] = 0;
    for (i = mb; i > 0; --i) {
        var pv = ri[i];
        fill(nb, i, pv, ri[i - 1] = pv + rc[i] * (1 << (mb - i)));
    }
    if (ri[0] != ts)
        err(0);
    for (i = 0; i < wc; ++i) {
        var bits = hw[i];
        if (bits) {
            var code = ri[bits];
            fill(syms, i, code, ri[bits] = code + (1 << (mb - bits)));
        }
    }
    return [bt, {
            n: nb,
            b: mb,
            s: syms
        }];
};
// Tables generated using this:
// https://gist.github.com/101arrowz/a979452d4355992cbf8f257cbffc9edd
// default literal length table
var dllt = /*#__PURE__*/ rfse(/*#__PURE__*/ new u8([
    81, 16, 99, 140, 49, 198, 24, 99, 12, 33, 196, 24, 99, 102, 102, 134, 70, 146, 4
]), 0, 6)[1];
// default match length table
var dmlt = /*#__PURE__*/ rfse(/*#__PURE__*/ new u8([
    33, 20, 196, 24, 99, 140, 33, 132, 16, 66, 8, 33, 132, 16, 66, 8, 33, 68, 68, 68, 68, 68, 68, 68, 68, 36, 9
]), 0, 6)[1];
// default offset code table
var doct = /*#__PURE__ */ rfse(/*#__PURE__*/ new u8([
    32, 132, 16, 66, 102, 70, 68, 68, 68, 68, 36, 73, 2
]), 0, 5)[1];
// bits to baseline
var b2bl = function (b, s) {
    var len = b.length, bl = new i32(len);
    for (var i = 0; i < len; ++i) {
        bl[i] = s;
        s += 1 << b[i];
    }
    return bl;
};
// literal length bits
var llb = /*#__PURE__ */ new u8(( /*#__PURE__ */new i32([
    0, 0, 0, 0, 16843009, 50528770, 134678020, 202050057, 269422093
])).buffer, 0, 36);
// literal length baseline
var llbl = /*#__PURE__ */ b2bl(llb, 0);
// match length bits
var mlb = /*#__PURE__ */ new u8(( /*#__PURE__ */new i32([
    0, 0, 0, 0, 0, 0, 0, 0, 16843009, 50528770, 117769220, 185207048, 252579084, 16
])).buffer, 0, 53);
// match length baseline
var mlbl = /*#__PURE__ */ b2bl(mlb, 3);
// decode huffman stream
var dhu = function (dat, out, hu) {
    var len = dat.length, ss = out.length, lb = dat[len - 1], msk = (1 << hu.b) - 1, eb = -hu.b;
    if (!lb)
        err(0);
    var st = 0, btr = hu.b, pos = (len << 3) - 8 + msb(lb) - btr, i = -1;
    for (; pos > eb && i < ss;) {
        var cbt = pos >> 3;
        var val = (dat[cbt] | (dat[cbt + 1] << 8) | (dat[cbt + 2] << 16)) >> (pos & 7);
        st = ((st << btr) | val) & msk;
        out[++i] = hu.s[st];
        pos -= (btr = hu.n[st]);
    }
    if (pos != eb || i + 1 != ss)
        err(0);
};
// decode huffman stream 4x
var dhu4 = function (dat, out, hu) {
    var bt = 6;
    var ss = out.length, sz1 = (ss + 3) >> 2, sz2 = sz1 << 1, sz3 = sz1 + sz2;
    dhu(dat.subarray(bt, bt += dat[0] | (dat[1] << 8)), out.subarray(0, sz1), hu);
    dhu(dat.subarray(bt, bt += dat[2] | (dat[3] << 8)), out.subarray(sz1, sz2), hu);
    dhu(dat.subarray(bt, bt += dat[4] | (dat[5] << 8)), out.subarray(sz2, sz3), hu);
    dhu(dat.subarray(bt), out.subarray(sz3), hu);
};
// read Zstandard block
var rzb = function (dat, st, out) {
    var _a;
    var bt = st.b;
    var b0 = dat[bt], btype = (b0 >> 1) & 3;
    st.l = b0 & 1;
    var sz = (b0 >> 3) | (dat[bt + 1] << 5) | (dat[bt + 2] << 13);
    var ebt = (bt += 3) + sz;
    if (btype == 1) {
        if (bt >= dat.length)
            return;
        st.b = bt + 1;
        if (out) {
            fill(out, dat[bt], st.y, st.y += sz);
            return out;
        }
        return fill(new u8(sz), dat[bt]);
    }
    if (ebt > dat.length)
        return;
    if (btype == 0) {
        st.b = ebt;
        if (out) {
            out.set(dat.subarray(bt, ebt), st.y);
            st.y += sz;
            return out;
        }
        return slc(dat, bt, ebt);
    }
    if (btype == 2) {
        var b3 = dat[bt], lbt = b3 & 3, sf = (b3 >> 2) & 3;
        var lss = b3 >> 4, lcs = 0, s4 = 0;
        if (lbt < 2) {
            if (sf & 1)
                lss |= (dat[++bt] << 4) | ((sf & 2) && (dat[++bt] << 12));
            else
                lss = b3 >> 3;
        }
        else {
            s4 = sf;
            if (sf < 2)
                lss |= ((dat[++bt] & 63) << 4), lcs = (dat[bt] >> 6) | (dat[++bt] << 2);
            else if (sf == 2)
                lss |= (dat[++bt] << 4) | ((dat[++bt] & 3) << 12), lcs = (dat[bt] >> 2) | (dat[++bt] << 6);
            else
                lss |= (dat[++bt] << 4) | ((dat[++bt] & 63) << 12), lcs = (dat[bt] >> 6) | (dat[++bt] << 2) | (dat[++bt] << 10);
        }
        ++bt;
        var buf = out ? out.subarray(st.y, st.y + st.m) : new u8(st.m);
        var spl = buf.length - lss;
        if (lbt == 0)
            buf.set(dat.subarray(bt, bt += lss), spl);
        else if (lbt == 1)
            fill(buf, dat[bt++], spl);
        else {
            var hu = st.h;
            if (lbt == 2) {
                var hud = rhu(dat, bt);
                lcs += bt - (bt = hud[0]);
                st.h = hu = hud[1];
            }
            else if (!hu)
                err(0);
            (s4 ? dhu4 : dhu)(dat.subarray(bt, bt += lcs), buf.subarray(spl), hu);
        }
        var ns = dat[bt++];
        if (ns) {
            if (ns == 255)
                ns = (dat[bt++] | (dat[bt++] << 8)) + 0x7F00;
            else if (ns > 127)
                ns = ((ns - 128) << 8) | dat[bt++];
            var scm = dat[bt++];
            if (scm & 3)
                err(0);
            var dts = [dmlt, doct, dllt];
            for (var i = 2; i > -1; --i) {
                var md = (scm >> ((i << 1) + 2)) & 3;
                if (md == 1) {
                    var rbuf = new u8([0, 0, dat[bt++]]);
                    dts[i] = {
                        s: rbuf.subarray(2, 3),
                        n: rbuf.subarray(0, 1),
                        t: new u16(rbuf.buffer, 0, 1),
                        b: 0
                    };
                }
                else if (md == 2) {
                    _a = rfse(dat, bt, 9 - (i & 1)), bt = _a[0], dts[i] = _a[1];
                }
                else if (md == 3) {
                    if (!st.t)
                        err(0);
                    dts[i] = st.t[i];
                }
            }
            var _b = st.t = dts, mlt = _b[0], oct = _b[1], llt = _b[2];
            var lb = dat[ebt - 1];
            if (!lb)
                err(0);
            var spos = (ebt << 3) - 8 + msb(lb) - llt.b, cbt = spos >> 3, oubt = 0;
            var lst = ((dat[cbt] | (dat[cbt + 1] << 8)) >> (spos & 7)) & ((1 << llt.b) - 1);
            cbt = (spos -= oct.b) >> 3;
            var ost = ((dat[cbt] | (dat[cbt + 1] << 8)) >> (spos & 7)) & ((1 << oct.b) - 1);
            cbt = (spos -= mlt.b) >> 3;
            var mst = ((dat[cbt] | (dat[cbt + 1] << 8)) >> (spos & 7)) & ((1 << mlt.b) - 1);
            for (++ns; --ns;) {
                var llc = llt.s[lst];
                var lbtr = llt.n[lst];
                var mlc = mlt.s[mst];
                var mbtr = mlt.n[mst];
                var ofc = oct.s[ost];
                var obtr = oct.n[ost];
                cbt = (spos -= ofc) >> 3;
                var ofp = 1 << ofc;
                var off = ofp + (((dat[cbt] | (dat[cbt + 1] << 8) | (dat[cbt + 2] << 16) | (dat[cbt + 3] << 24)) >>> (spos & 7)) & (ofp - 1));
                cbt = (spos -= mlb[mlc]) >> 3;
                var ml = mlbl[mlc] + (((dat[cbt] | (dat[cbt + 1] << 8) | (dat[cbt + 2] << 16)) >> (spos & 7)) & ((1 << mlb[mlc]) - 1));
                cbt = (spos -= llb[llc]) >> 3;
                var ll = llbl[llc] + (((dat[cbt] | (dat[cbt + 1] << 8)) >> (spos & 7)) & ((1 << llb[llc]) - 1));
                cbt = (spos -= lbtr) >> 3;
                lst = llt.t[lst] + (((dat[cbt] | (dat[cbt + 1] << 8)) >> (spos & 7)) & ((1 << lbtr) - 1));
                cbt = (spos -= mbtr) >> 3;
                mst = mlt.t[mst] + (((dat[cbt] | (dat[cbt + 1] << 8)) >> (spos & 7)) & ((1 << mbtr) - 1));
                cbt = (spos -= obtr) >> 3;
                ost = oct.t[ost] + (((dat[cbt] | (dat[cbt + 1] << 8)) >> (spos & 7)) & ((1 << obtr) - 1));
                if (off > 3) {
                    st.o[2] = st.o[1];
                    st.o[1] = st.o[0];
                    st.o[0] = off -= 3;
                }
                else {
                    var idx = off - (ll != 0);
                    if (idx) {
                        off = idx == 3 ? st.o[0] - 1 : st.o[idx];
                        if (idx > 1)
                            st.o[2] = st.o[1];
                        st.o[1] = st.o[0];
                        st.o[0] = off;
                    }
                    else
                        off = st.o[0];
                }
                for (var i = 0; i < ll; ++i) {
                    buf[oubt + i] = buf[spl + i];
                }
                oubt += ll, spl += ll;
                var stin = oubt - off;
                if (stin < 0) {
                    var len = -stin;
                    var bs = st.e + stin;
                    if (len > ml)
                        len = ml;
                    for (var i = 0; i < len; ++i) {
                        buf[oubt + i] = st.w[bs + i];
                    }
                    oubt += len, ml -= len, stin = 0;
                }
                for (var i = 0; i < ml; ++i) {
                    buf[oubt + i] = buf[stin + i];
                }
                oubt += ml;
            }
            if (oubt != spl) {
                while (spl < buf.length) {
                    buf[oubt++] = buf[spl++];
                }
            }
            else
                oubt = buf.length;
            if (out)
                st.y += oubt;
            else
                buf = slc(buf, 0, oubt);
        }
        else if (out) {
            st.y += lss;
            if (spl) {
                for (var i = 0; i < lss; ++i) {
                    buf[i] = buf[spl + i];
                }
            }
        }
        else if (spl)
            buf = slc(buf, spl);
        st.b = ebt;
        return buf;
    }
    err(2);
};
var cct = function (bufs, ol) {
    if (bufs.length == 1)
        return bufs[0];
    var buf = new u8(ol);
    for (var i = 0, b = 0; i < bufs.length; ++i) {
        var chk = bufs[i];
        buf.set(chk, b);
        b += chk.length;
    }
    return buf;
};
function decompress(dat, buf) {
    var bufs = [], nb = +!buf;
    var bt = 0, ol = 0;
    for (; dat.length;) {
        var st = rzfh(dat, nb || buf);
        if (typeof st == 'object') {
            if (nb) {
                buf = null;
                if (st.w.length == st.u) {
                    bufs.push(buf = st.w);
                    ol += st.u;
                }
            }
            else {
                bufs.push(buf);
                st.e = 0;
            }
            for (; !st.l;) {
                var blk = rzb(dat, st, buf);
                if (!blk)
                    err(5);
                if (buf)
                    st.e = st.y;
                else {
                    bufs.push(blk);
                    ol += blk.length;
                    cpw(st.w, 0, blk.length);
                    st.w.set(blk, st.w.length - blk.length);
                }
            }
            bt = st.b + (st.c * 4);
        }
        else
            bt = st;
        dat = dat.subarray(bt);
    }
    return cct(bufs, ol);
}
exports.decompress = decompress;

var Decompress = /*#__PURE__*/ (function () {
    function Decompress(ondata) {
        this.ondata = ondata;
        this.c = [];
        this.l = 0;
        this.z = 0;
    }
    Decompress.prototype.push = function (chunk, final) {
        if (typeof this.s == 'number') {
            var sub = Math.min(chunk.length, this.s);
            chunk = chunk.subarray(sub);
            this.s -= sub;
        }
        var sl = chunk.length;
        var ncs = sl + this.l;
        if (!this.s) {
            if (final) {
                if (!ncs) {
                    this.ondata(new u8(0), true);
                    return;
                }
                if (ncs < 5)
                    err(5);
            }
            else if (ncs < 18) {
                this.c.push(chunk);
                this.l = ncs;
                return;
            }
            if (this.l) {
                this.c.push(chunk);
                chunk = cct(this.c, ncs);
                this.c = [];
                this.l = 0;
            }
            if (typeof (this.s = rzfh(chunk)) == 'number')
                return this.push(chunk, final);
        }
        if (typeof this.s != 'number') {
            if (ncs < (this.z || 3)) {
                if (final)
                    err(5);
                this.c.push(chunk);
                this.l = ncs;
                return;
            }
            if (this.l) {
                this.c.push(chunk);
                chunk = cct(this.c, ncs);
                this.c = [];
                this.l = 0;
            }
            if (!this.z && ncs < (this.z = (chunk[this.s.b] & 2) ? 4 : 3 + ((chunk[this.s.b] >> 3) | (chunk[this.s.b + 1] << 5) | (chunk[this.s.b + 2] << 13)))) {
                if (final)
                    err(5);
                this.c.push(chunk);
                this.l = ncs;
                return;
            }
            else
                this.z = 0;
            for (;;) {
                var blk = rzb(chunk, this.s);
                if (!blk) {
                    if (final)
                        err(5);
                    var adc = chunk.subarray(this.s.b);
                    this.s.b = 0;
                    this.c.push(adc), this.l += adc.length;
                    return;
                }
                else {
                    this.ondata(blk, false);
                    cpw(this.s.w, 0, blk.length);
                    this.s.w.set(blk, this.s.w.length - blk.length);
                }
                if (this.s.l) {
                    var rest = chunk.subarray(this.s.b);
                    this.s = this.s.c * 4;
                    this.push(rest, final);
                    return;
                }
            }
        }
        else if (final)
            err(5);
    };
    return Decompress;
}());
exports.Decompress = Decompress;

  return exports;
}
