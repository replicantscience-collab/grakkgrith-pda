/* PDA field symbols. Original SVG geometry; no embedded text, external fonts or raster assets.
   Call svg(name) inside a labelled button, or provide adjacent visible text. */
(function(root){
  'use strict';
  const paths={
    district:'<path d="m3 5 6-2 6 2 6-2v16l-6 2-6-2-6 2Z M9 3v16 M15 5v16"/>',
    landmark:'<path d="m12 3 6 8H6Z M9 11v8 M15 11v8 M5 21h14 M7 19h10"/>',
    shop:'<path d="M4 10v10h16V10 M3 10l2-6h14l2 6 M8 4l-1 6 M16 4l1 6 M3 10q2 4 4 0 2 4 5 0 3 4 5 0 2 4 4 0 M10 20v-6h4v6"/>',
    food:'<path d="M4 3v6q0 3 3 3V3 M10 3v6q0 3-3 3v9 M18 3q-5 4-3 10h4 M19 3v18"/>',
    housing:'<path d="m3 11 9-8 9 8 M5 10v11h14V10 M10 21v-7h4v7"/>',
    transit:'<rect x="5" y="3" width="14" height="16" rx="3"/><path d="M5 11h14 M12 3v8 M8 19l-2 3 M16 19l2 3"/><circle cx="8" cy="15" r="1"/><circle cx="16" cy="15" r="1"/>',
    civic:'<path d="m3 8 9-5 9 5Z M5 11v7 M10 11v7 M14 11v7 M19 11v7 M3 21h18 M4 18h16"/>',
    corporate:'<path d="M6 21V3h12v18 M3 21h18 M9 7h1 M14 7h1 M9 11h1 M14 11h1 M10 21v-5h4v5"/>',
    industrial:'<path d="M3 21V11l6-4v4l6-4v4h6v10Z M17 11V3h3v8 M6 16h2 M11 16h2 M16 16h2"/>',
    street:'<path d="m7 3-4 18 M17 3l4 18 M12 4v3 M12 11v3 M12 18v3"/>',
    market:'<path d="M3 9h18l-2 11H5Z M7 9l5-6 5 6 M8 13v3 M12 13v3 M16 13v3"/>',
    sacred:'<path d="m12 2 3 7 7 3-7 3-3 7-3-7-7-3 7-3Z"/><circle cx="12" cy="12" r="2"/>',
    venue:'<path d="M14 4v12 M14 4l6-1v5l-6 1"/><ellipse cx="10" cy="17" rx="4" ry="3"/><path d="m3 4 1 2 2 1-2 1-1 2-1-2"/>',
    roll:'<rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="7" cy="7" r="1"/><circle cx="17" cy="7" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="7" cy="17" r="1"/><circle cx="17" cy="17" r="1"/>',
    weapon:'<path d="m5 19 4-4 M3 17l4 4 M7 13l4 4 M9 15 20 4l-1 6-8 7 M14 10l3 3"/>',
    armor:'<path d="m12 3 8 3v6c0 5-8 9-8 9s-8-4-8-9V6Z M12 7v10 M8 11h8"/>',
    ammo:'<path d="M5 10V6l3-3 3 3v4 M5 10h6v11H5Z M15 12V8l2-3 2 3v4 M15 12h4v9h-4Z M5 17h6 M15 17h4"/>',
    item:'<path d="m4 7 8-4 8 4v10l-8 4-8-4Z M4 7l8 4 8-4 M12 11v10 M8 5l8 4"/>',
    bag:'<rect x="5" y="7" width="14" height="14" rx="3"/><path d="M9 7V5a3 3 0 0 1 6 0v2 M5 12h14 M9 16h6"/>',
    use:'<path d="M8 3h8 M9 3v5l-4 8q-2 5 3 5h8q5 0 3-5l-4-8V3 M7 14h10 M12 15v4 M10 17h4"/>',
    reload:'<path d="M20 9a8 8 0 0 0-14-3L3 9 M3 3v6h6 M4 15a8 8 0 0 0 14 3l3-3 M21 21v-6h-6"/>',
    undo:'<path d="m8 4-5 5 5 5 M3 9h10a7 7 0 0 1 0 14"/>',
    workshop:'<path d="M20 3a6 6 0 0 0-8 8L3 20l2 2 9-9a6 6 0 0 0 8-8l-4 4-3-3Z"/>',
    location:'<path d="M19 10c0 5-7 12-7 12S5 15 5 10a7 7 0 0 1 14 0Z"/><circle cx="12" cy="10" r="2"/>'
  };
  const labels={district:'District',landmark:'Landmark',shop:'Shop',food:'Food',housing:'Housing',transit:'Transit stop',civic:'Civic and legal',corporate:'Corporate',industrial:'Industrial',street:'Street',market:'Market',sacred:'Sacred place',venue:'Venue',roll:'Roll',weapon:'Weapon / attack',armor:'Armor',ammo:'Ammo',item:'Item',bag:'Bag',use:'Use / recovery',reload:'Reload',undo:'Undo',workshop:'Workshop',location:'Your location'};
  const svg=name=>'<svg class="pdaIcon" viewBox="0 0 24 24" width="24" height="24" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">'+(paths[name]||paths.landmark)+'</svg>';
  root.PDA_ICONS=Object.freeze({svg,labels:Object.freeze(labels),names:Object.freeze(Object.keys(paths))});
})(window);
