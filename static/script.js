var main_response, selected_path_points=[], mds_pcp_flag=true;

  
function load_data(){
    d3.json("/data").then(function(response) {
        main_response=response;
    })
    .then(function(){
       lineChart();
    })
    .then(function(){
        timeSeriesPlot();
     })
     .then(function(){
        drawWorldMap();
     })
     .then(function(){
        renderPCP();
     })
     .then(function(){
        drawSunburst();
     })
     .then(function(){
        drawWordCloud();
     })
}
load_data()

var selectedPath = null;  // Global variable to track the selected path

function lineChart() {
    var svgWidth = 850, svgHeight = 230;
    var margin = { top: 40, right: 180, bottom: 20, left: 60 };
    var width = svgWidth - margin.left - margin.right;
    var height = svgHeight - margin.top - margin.bottom;

    // Remove any existing SVG to avoid duplicates
    d3.select("#line-plot").select("svg").remove();

    var svg = d3.select("#line-plot").append("svg")
        .attr("width", svgWidth)
        .attr("height", svgHeight)
        .append("g")
        .attr("transform", "translate(" + margin.left + "," + margin.top + ")");

    var x = d3.scaleTime().range([0, width]);
    var y = d3.scaleLinear().range([height, 0]);
    var color = d3.scaleOrdinal(d3.schemeCategory10);

    var line = d3.line()
        .x(function(d) { return x(d.date); })
        .y(function(d) { return y(d.frequency); });

    var songData = JSON.parse(main_response.song_frequency_over_time);

    songData.forEach(function(d) {
        d.snapshot_date = new Date(d.snapshot_date);
    });

    color.domain(Object.keys(songData[0]).filter(function(key) { return key !== "snapshot_date"; }));

    var songs = color.domain().map(function(name) {
        return {
            name: name,
            values: songData.map(function(d) {
                return {date: d.snapshot_date, frequency: +d[name]};
            })
        };
    });

    x.domain(d3.extent(songData, function(d) { return d.snapshot_date; }));
    y.domain([
        0,
        d3.max(songs, function(c) { return d3.max(c.values, function(v) { return v.frequency; }); })
    ]);

   // Function to decide the number of ticks based on the time range
   function adjustTickInterval(startDate, endDate) {
        const totalDays = (endDate - startDate) / (1000 * 3600 * 24);

        if (totalDays <= 10) {
            return d3.timeDay.every(1);
        } 
        else if (totalDays <= 20) {
            return d3.timeDay.every(2);
        } else if (totalDays <= 90) {
            return d3.timeWeek.every(1);
        } else if (totalDays <= 365) {
            return d3.timeMonth.every(1);
        } 
    }

    const xAxisTicks = adjustTickInterval(x.domain()[0], x.domain()[1]);



    var transform=null
    svg.append("g")
    .attr("class", "x axis")
    .attr("transform", "translate(0," + height + ")")
    .call(d3.axisBottom(x).ticks(xAxisTicks).tickFormat(d3.timeFormat("%m-%d")))
    .selectAll(".tick")  // Select all ticks
    .each(function(d) {  // 'd' is the date object bound to the tick
            if (transform==null){
                transform = d3.select(this).attr("transform");
                transform = transform.substring(transform.indexOf("(") + 1, transform.indexOf(","));
            }
            newTransform=d3.select(this).attr("transform");
            newTransform = newTransform.substring(newTransform.indexOf("(") + 1, newTransform.indexOf(","));

            d3.select(this).attr("transform", "translate("+(newTransform-transform)+", 0)");  
        
    })


    svg.append("g")
        .attr("class", "y axis")
        .call(d3.axisLeft(y));

    // Add Y Axis title
    svg.append("text")
        .attr("transform", "rotate(-90)")
        .attr("y", 0 - margin.left)
        .attr("x", 0 - (height / 2))
        .attr("dy", "1em")
        .attr("text-anchor", "middle")
        .text("Frequency"); // Change this text to your desired title

    // Drawing the lines for each song
    var song = svg.selectAll(".song")
        .data(songs)
        .enter().append("g")
        .attr("class", "song");

    var highlightElements = function() {
        if(! selectedPath) {
            var selected = this;
            d3.selectAll(".line").filter(function() {
                return this !== selected;
            }).classed("faded", true);
            d3.selectAll(".line").classed("highlight", false)
            d3.select(this).classed("highlight", true).classed("faded", false);
        }
    };

    var resetElements = function() {
        if(! selectedPath) {
            d3.selectAll(".line").classed("faded", false).classed("highlight", false);
        }
    };

    song.append("path")
        .attr("class", "line")
        .attr("d", function(d) { return line(d.values); })
        .style("stroke", function(d) { return color(d.name); })
        .on("click", function(event, d) {
            if(! selectedPath) {
                var songDataToSend = {
                    songName: d.name,
                    values: d.values.map(v => ({date: v.date.toISOString(), frequency: v.frequency}))
                };
        
                // Send data to Flask server
                fetch('/update-selected-song', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(songDataToSend)
                })
                .then(response => response.json())
                .then(
                    d3.json("/data").then(function(response) {
                        main_response=response;
                    })
                    .then(function(){
                        drawWorldMap();
                     })
                     .then(function(){
                        renderPCP();
                     })
                     .then(function(){
                        d3.select("#sunburst-chart").select("svg").remove();
                        drawSunburst();
                     })
                )
                .catch((error) => {
                    console.error('Error:', error);
                });

                // event.stopPropagation();  // Stop propagation to avoid background click event
                if (selectedPath) {
                    selectedPath.classed("selected", false);
                }
                selectedPath = d3.select(this).classed("selected", true);
                d3.selectAll(".line").classed("faded", true);
                selectedPath.classed("faded", false);

                // Highlight corresponding legend entry
                d3.selectAll(".legend-entry").classed("highlight", false); // Deselect all legend texts
                d3.selectAll(".legend-entry").classed("faded", true);
                d3.selectAll(".legend-entry").each(function(entry) {
                    if (entry.name === d.name) {
                        d3.select(this).classed("highlight", true); // Highlight the legend text corresponding to the selected path
                    }
                });
            }
        })
        .on("mouseover", highlightElements)
        .on("mouseout", resetElements);

    // Inserting a transparent rectangle to capture click events
    svg.insert("rect", ":first-child")
        .attr("class", "event-capture")
        .attr("width", svgWidth)
        .attr("height", svgHeight)
        .attr("fill", "none")
        .style("pointer-events", "all")
        .on("click", function() {
            if (selectedPath) {
                fetch('/update-selected-song', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ songName: "all" })
                })
                .then(response => response.json())
                .then(
                    d3.json("/data").then(function(response) {
                        main_response=response;
                    })
                    .then(function(){
                        drawWorldMap();
                     })
                     .then(function(){
                        renderPCP();
                     })
                     .then(function(){
                        drawSunburst();
                     })
                )
                .catch((error) => {
                    console.error('Error on click:', error);
                });
                selectedPath.classed("selected", false).classed("faded", false);
                d3.selectAll(".line").classed("faded", false);
                selectedPath = null;

                // Highlight corresponding legend entry
                d3.selectAll(".legend-entry").classed("highlight", false); // Deselect all legend texts
                d3.selectAll(".legend-entry").classed("faded", false);
            }
        });

    // Creating a legend
    var legend = svg.append("g")
        .attr("class", "legend")
        .attr("transform", "translate(" + (width + 5) + ",10)");

        svg.append("text")
        .attr("x", width / 2)
        .attr("y", 0 - (margin.top / 2))
        .attr("text-anchor", "middle")
        .style("font-size", "20px")
        .style("font-weight","bold")
        .text("Top 10 Song Frequency Over Time");

    legend.selectAll(".legend-entry")
        .data(songs)
        .enter().append("g")
        .attr("class", "legend-entry")
        .attr("transform", function(d, i) { return "translate(0," + i * 15 + ")"; })
        .each(function(d) {
            d3.select(this).append("rect")
                .attr("width", 10)
                .attr("height", 10)
                .attr("fill", color(d.name));

            d3.select(this).append("text")
                .attr("x", 15)
                .attr("y", 10)
                .text(d.name)
                .style("font", "10px sans-serif")
                .attr("text-anchor", "start");
        });
}



function timeSeriesPlot() {
    // Existing code to parse data and set up the graph
    var songData = JSON.parse(main_response.song_frequency_over_time);
    var parseDate = d3.timeParse("%Y-%m-%d");

    var fixedStartDate = new Date(main_response.fixed_start_date)
    var fixedEndDate = new Date(main_response.fixed_end_date)
    
    songData.forEach(function(d) {
        d.snapshot_date = parseDate(d.snapshot_date);
    });

    var margin = { top: 0, right: 20, bottom: 50, left: 60 },
        width = 690 - margin.left - margin.right,
        height = 70 - margin.top - margin.bottom;

    var svg = d3.select("#date-selector").append("svg")
        .attr("width", width + margin.left + margin.right)
        .attr("height", height + margin.top + margin.bottom)
        .append("g")
        .attr("transform", "translate(" + margin.left + "," + margin.top + ")");

    var x = d3.scaleTime()
        .range([0, width])
        .domain([fixedStartDate, fixedEndDate]);

    var xAxis = d3.axisBottom(x)
        .ticks(d3.timeWeek.every(1))
        .tickFormat(d3.timeFormat("%m-%d"));

    svg.append("g")
        .attr("class", "x-axis")
        .attr("transform", "translate(0," + height + ")")
        .call(xAxis)
        .selectAll("text")
        .style("text-anchor", "end")
        .attr("dx", "1em")
        .attr("dy", "1em");

    // Adding the x-axis title
    svg.append("text")
        .attr("class", "x axis-title")
        .attr("text-anchor", "middle")
        .attr("x", width / 2)
        .attr("y", height + margin.bottom - 5)  // Adjust this value to position your x-axis title
        .text("Date (MM-DD)"); // Customize your axis title here

    // Brush setup
    var brush = d3.brushX()
        .extent([[0, 0], [width, height]])
        .on("end", updateDateRange);

    svg.append("g")
        .attr("class", "brush")
        .call(brush)
        .call(brush.move, x.range()); // Set initial brush selection to the full range

    function updateDateRange(event) {
        const selection = event.selection;
        if (!selection) return; // Ignore empty selections
    
        var startDate = x.invert(selection[0]);
        var endDate = x.invert(selection[1]);
        const oneDay = 86400000; // milliseconds in one day
        const minDuration = 7 * oneDay; // minimum duration of 7 days
        
        // Check if the dates are valid
        if (!(startDate instanceof Date && !isNaN(startDate)) || !(endDate instanceof Date && !isNaN(endDate))) {
            console.error("Invalid date(s) detected:", startDate, endDate);
            return; // Stop the function if dates are invalid
        }
    
        // Check if the duration is less than 7 days
        if (endDate - startDate < minDuration) {
            endDate = new Date(startDate.getTime() + minDuration); // Set end date to start date + 7 days
            d3.select(".brush").call(brush.move, [x(startDate), x(endDate)]);
        }
    
        sendDateRangeToFlask(startDate, endDate);
    }
    


    // Function to send data to Flask
    function sendDateRangeToFlask(startDate, endDate) {
        if (selectedPath)
        {
            selectedPath.classed("selected", false).classed("faded", false);
            d3.selectAll(".line").classed("faded", false);
            selectedPath = null;

            // Highlight corresponding legend entry
            d3.selectAll(".legend-entry").classed("highlight", false); // Deselect all legend texts
            d3.selectAll(".legend-entry").classed("faded", false);
        }

        fetch('/update-date-range', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                start_date: startDate.toISOString().slice(0, 10),
                end_date: endDate.toISOString().slice(0, 10)
            })
        }).then(response => response.json())
          .then(d3.json("/data").then(function(response) {
                    main_response=response;
                })
                .then(function(){
                    lineChart();
                })             
                .then(function(){
                    drawWorldMap();
                })
                .then(function(){
                    renderPCP();
                })
                .then(function(){
                    drawSunburst();
                })
                .then(function(){
                    drawWordCloud();
                })
          ) 
          .catch((error) => console.error('Error:', error));
    }
}




function drawWorldMap() {
    // Assuming main_response.country_frequency_dict is already parsed and accessible
    const countryFrequencyData = main_response.country_frequency_dict;

    // Load and display the World Atlas TopoJSON
    d3.json("https://d3js.org/world-110m.v1.json").then(function(world) {
        const countries = topojson.feature(world, world.objects.countries).features;
        const frequencies = countries.map(d => countryFrequencyData[d.id]?.frequency || 0);
        const colorScale = d3.scaleSequential(d3.interpolatePlasma)
                             .domain([d3.max(frequencies), d3.min(frequencies)]);

        d3.select("#world-map").select("svg").remove();
        const svg = d3.select("#world-map").append("svg")
                      .attr("width", 600)
                      .attr("height", 300);

        const projection = d3.geoMercator()
                             .scale(70)
                             .translate([270, 215]);

        const path = d3.geoPath().projection(projection);

        // Variable to keep track of the highlighted country
        let highlighted = null;

        svg.on("click", function(event) {
            const clickedElement = d3.select(event.target);
        
            if (clickedElement.node().nodeName !== "path" || !clickedElement.classed("country-path")) {

                // Reset previous highlight
                if (highlighted) {
                    d3.select(highlighted).attr("fill", d => {
                        const frequency = countryFrequencyData[d.id]?.frequency;
                        return frequency ? colorScale(frequency) : "#ccc";
                    });
                }

                fetch('/country_data', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        country_code: "all",
                    })
                }).then(response => response.json())
                  .then(() => d3.json("/data").then(function(response) {
                      main_response = response;
                  }).then(() => {
                      drawSunburst();
                  }).then(function(){
                    renderPCP();
                 }).then(() => {
                    drawWordCloud();
                }))
                  .catch(error => console.error('Error:', error));
            }
        });
        
        const tooltip = d3.select("body").append("div")
                          .attr("class", "tooltip")
                          .style("position", "absolute")
                          .style("visibility", "hidden")
                          .style("background", "lightgrey")
                          .style("border", "solid 1px black")
                          .style("border-radius", "5px")
                          .style("padding", "5px");

        const countryPaths = svg.selectAll("path")
           .data(countries)
           .enter().append("path")
           .attr("class", "country-path")
           .attr("d", path)
           .attr("fill", d => {
               const frequency = countryFrequencyData[d.id]?.frequency;
               return frequency ? colorScale(frequency) : "#ccc";
           })
           .attr("stroke", "white")
           .on("mouseover", function(event, d) {
               const countryInfo = countryFrequencyData[d.id];
               if (countryInfo) {
                   tooltip.style("visibility", "visible")
                          .html(`${countryInfo.country_name}: ${parseFloat(countryInfo.frequency).toFixed(2)}`)
                          .style("top", `${event.pageY - 10}px`)
                          .style("left", `${event.pageX + 10}px`);
               }
           })
           .on("mouseout", function() {
               tooltip.style("visibility", "hidden");
           })
           .on("click", function(event, d) {
                const countryInfo = countryFrequencyData[d.id];
                if (countryInfo) {
                    // Reset previous highlight
                    if (highlighted) {
                        d3.select(highlighted).attr("fill", d => {
                            const frequency = countryFrequencyData[d.id]?.frequency;
                            return frequency ? colorScale(frequency) : "#ccc";
                        });
                    }
                    // Highlight the clicked country
                    d3.select(this)
                      .attr("fill", "red");

                    // Update the highlighted element
                    highlighted = this;

                    fetch('/country_data', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify({
                            country_code: countryInfo.country,
                        })
                    }).then(response => response.json())
                    .then(() => d3.json("/data").then(function(response) {
                        main_response = response;
                    }).then(() => {
                        drawSunburst();
                    }).then(function(){
                        renderPCP();
                    }).then(() => {
                        drawWordCloud();
                    }))
                    .catch(error => console.error('Error:', error));
                }
            });

            svg.append("text")
            .attr("x", 350)  // Center the text
            .attr("y", 20)   // Position the text 30 units down from the top
            .attr("text-anchor", "middle")  // Center-align the text
            .style("font-size", "20px")  // Font size for the title
            .style("font-weight","bold")
            .text("Choropleth World Map");  // Text content

        // Create gradient for legend
        const defs = svg.append("defs");
        const linearGradient = defs.append("linearGradient")
                                   .attr("id", "gradient-color")
                                   .attr("x1", "0%")
                                   .attr("x2", "0%")
                                   .attr("y1", "100%")
                                   .attr("y2", "0%");

        // Create a smooth gradient by interpolating over many points
        const numStops = 10;  // Increase for smoother gradients
        const gradientRange = d3.range(numStops).map(i => i / (numStops - 1));
        linearGradient.selectAll("stop")
                      .data(gradientRange)
                      .enter().append("stop")
                      .attr("offset", d => `${d * 100}%`)
                      .attr("stop-color", d => colorScale(d * (d3.max(frequencies) - d3.min(frequencies)) + d3.min(frequencies)));

        // Add color scale legend vertically
        const legendHeight = 200;
        const legendWidth = 20;
        const legend = svg.append("g")
                          .attr("transform", "translate(560, 50)");  // Position the legend on the right

        legend.append("rect")
              .attr("width", legendWidth)
              .attr("height", legendHeight)
              .style("fill", "url(#gradient-color)");

        // Add minimum and maximum labels for the legend
        legend.append("text")
              .attr("x", -5)
              .attr("y", legendHeight+7)
              .attr("alignment-baseline", "hanging")
              .text(d3.min(frequencies).toFixed(2));

        legend.append("text")
              .attr("x", -5)
              .attr("y", -7)
              .attr("alignment-baseline", "baseline")
              .attr("text-anchor", "start")
              .text(d3.max(frequencies).toFixed(2));

        }).catch(function(error) {
        console.error('Error loading or processing data:', error);
    });
}



function drawSunburst() {
    const width = 288;
    const height = width;
    const radius = width / 7;

    const data = main_response.genre_data;
    const color = d3.scaleOrdinal(d3.quantize(t => d3.interpolateRainbow(t * 0.9 + 0.1), data.children.length + 1)); // Adjust the range within the rainbow


    const hierarchy = d3.hierarchy(data)
        .sum(d => d.value)
        .sort((a, b) => b.value - a.value);
    const root = d3.partition()
        .size([2 * Math.PI, hierarchy.height + 1])
    (hierarchy);
    root.each(d => d.current = d);

    const arc = d3.arc()
        .startAngle(d => d.x0)
        .endAngle(d => d.x1)
        .padAngle(d => Math.min((d.x1 - d.x0) / 2, 0.005))
        .padRadius(radius * 1.5)
        .innerRadius(d => d.y0 * radius)
        .outerRadius(d => Math.max(d.y0 * radius, d.y1 * radius - 1));

    d3.select("#sunburst-chart").select("svg").remove();

    const svg = d3.select("#sunburst-chart").selectAll("svg").data([null]);
    const svgEnter = svg.enter().append("svg")
        .merge(svg)
        .attr("viewBox", [-width / 2 - 10, -height / 2 - 10, width, height])
        .attr("width", width+20)
        .attr("height", height)
        .style("font", "8px sans-serif");

    svgEnter.append("text")
        .attr("x", 0) // Positioning text at the center
        .attr("y", -height / 2 + 10) // Positioning text 20 pixels from the top edge of the SVG
        .attr("text-anchor", "middle") // Centering text horizontally
        .style("font-size", "20px") // Font size of the title
        .style("font-weight", "bold") // Font weight of the title
        .text("Genre Sunburst"); // The title text

    const path = svgEnter.append("g")
        .selectAll("path")
        .data(root.descendants().slice(1))
        .join("path")
          .attr("fill", d => { while (d.depth > 1) d = d.parent; return color(d.data.name); })
          .attr("fill-opacity", d => arcVisible(d.current) ? (d.children ? 0.8 : 0.6) : 0)
          .attr("pointer-events", d => arcVisible(d.current) ? "auto" : "none")
          .attr("d", d => arc(d.current));

    // Make them clickable if they have children.
    path.filter(d => d.children)
    .style("cursor", "pointer")
    .on("click", clicked);

    const format = d3.format(",d");
    path.append("title")
    .text(d => `${d.ancestors().map(d => d.data.name).reverse().join("/")}\n${format(d.value)}`);

    const labelGroup = svgEnter.append("g")
    .attr("pointer-events", "none")
    .attr("text-anchor", "middle")
    .style("user-select", "none")
    .selectAll("text")
    .data(root.descendants().slice(1))
    .join("text")
    .attr("fill-opacity", d => +labelVisible(d.current))
    .attr("transform", d => labelTransform(d.current))
    .each(function(d) {
        const text = d.data.name;
        const shortenedText = text.length <= 8 ? text : `${text.substring(0, 8)}`;
        const percentage = ((d.x1 - d.x0) / (2 * Math.PI) * 100).toFixed(2);
        d3.select(this).append("tspan")
            .text(shortenedText)
            .attr("x", 0)
            .attr("dy", "0.35em");
        d3.select(this).append("tspan")
            .text(`(${percentage}%)`)
            .attr("x", 0)
            .attr("dy", "1.2em");
    });

    const parent = svgEnter.append("circle")
    .datum(root)
    .attr("r", radius)
    .attr("fill", "none")
    .attr("pointer-events", "all")
    .on("click", clicked);

    function clicked(event, p) {
        fetch('/update-genre', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                genre: p.data.name
            })
        }).then(response => response.json())
        .then(() => d3.json("/data").then(function(response) {
            main_response = response;
        }).then(() => {
            renderPCP();
        }))
        .catch(error => console.error('Error:', error));


        parent.datum(p.parent || root);

        root.each(d => d.target = {
            x0: Math.max(0, Math.min(1, (d.x0 - p.x0) / (p.x1 - p.x0))) * 2 * Math.PI,
            x1: Math.max(0, Math.min(1, (d.x1 - p.x0) / (p.x1 - p.x0))) * 2 * Math.PI,
            y0: Math.max(0, d.y0 - p.depth),
            y1: Math.max(0, d.y1 - p.depth)
        });

        const t = svgEnter.transition().duration(750);

        path.transition(t)
            .tween("data", function(d) {
                const i = d3.interpolate(d.current, d.target);
                return function(t) {
                    d.current = i(t);
                    return arc(d.current);
                };
            })
            .filter(function(d) {
              return +this.getAttribute("fill-opacity") || arcVisible(d.target);
            })
              .attr("fill-opacity", d => arcVisible(d.target) ? (d.children ? 0.8 : 0.6) : 0)
              .attr("pointer-events", d => arcVisible(d.target) ? "auto" : "none") 
      
              .attrTween("d", d => () => arc(d.current));;
    
              labelGroup.filter(function(d) {
                return +this.getAttribute("fill-opacity") || labelVisible(d.target);
              }).transition(t)
                .attr("fill-opacity", d => +labelVisible(d.target))
                .attrTween("transform", d => () => labelTransform(d.current));
    }

    function labelTransform(d) {
        const x = (d.x0 + d.x1) / 2 * 180 / Math.PI;
        const y = (d.y0 + d.y1) / 2 * radius;
        return `rotate(${x - 90}) translate(${y},0) rotate(${x < 180 ? 0 : 180})`;
    }

    function arcVisible(d) {
        return d.y1 <= 3 && d.y0 >= 1 && d.x1 > d.x0;
    }

    function labelVisible(d) {
    return d.y1 <= 3 && d.y0 >= 1 && (d.y1 - d.y0) * (d.x1 - d.x0) > 0.03 && arcVisible(d);
}

}



function renderPCP() {
    var pcpData;

    // Check if MDS-PCP flag is set to true or false
    if (mds_pcp_flag == true) {
        pcpData = JSON.parse(main_response.pcp_data);
    } else {
        pcpData = JSON.parse(main_response.pcp_data);

        // Extract selected data points
        const selectedData = pcpData.map(obj => {
            const selectedObj = { "Cluster": obj.Cluster }; // Adding "Cluster" key by default
            selected_path_points.forEach(({ Variable }) => {
                if (obj.hasOwnProperty(Variable)) {
                    selectedObj[Variable] = obj[Variable];
                }
            });
            return selectedObj;
        });

        pcpData = selectedData;
    }

    // Remove any existing SVG to prevent duplicates
    d3.select("#pcp-plot").select("svg").remove();

    // Define margins, width, and height for the plot area
    const margin = { top: 50, right: 5, bottom: 10, left: 5 }, // Increased left margin for axis labels
        width = 690 - margin.left - margin.right,
        height = 288 - margin.top - margin.bottom;

    // Append SVG and a group element to the DOM
    const svg = d3.select("#pcp-plot")
        .append("svg")
        .attr("width", width + margin.left + margin.right)
        .attr("height", height + margin.top + margin.bottom)
        .append("g")
        .attr("transform", `translate(${margin.left},${margin.top})`);

    // Add title to the plot
    svg.append("text")
        .attr("class", "plot-title")
        .attr("x", 340)
        .attr("y", -30)
        .attr("text-anchor", "middle")
        .text("Parallel Coordinate Plot")
        .style("font-size", "20px") 
        .style("font-weight", "bold");

    // Determine dimensions excluding 'Cluster'
    const dimensions = Object.keys(pcpData[0]).filter(d => d !== "Cluster");

    // X scale mapping dimension names to positions
    const x = d3.scalePoint()
        .range([0, width])
        .padding(1)
        .domain(dimensions);

    // Y scales for each dimension
    const y = {};
    dimensions.forEach(d => {
        y[d] = d3.scaleLinear()
            .domain(d3.extent(pcpData, p => +p[d]))
            .range([height, 0]);
    });

    // Color scale for different clusters
    const color = d3.scaleOrdinal(d3.schemeCategory10);

    // Define and append paths for the PCP lines
    const pathsGroup = svg.append("g");

    // Function to update paths
    function updatePaths(data) {
        const paths = pathsGroup.selectAll("path")
            .data(data);

        paths.enter().append("path")
            .merge(paths) // Merge enter and update selection
            .attr("d", drawPath)
            .style("stroke", d => color(d.Cluster))
            .style("opacity", 0.5);

        paths.exit().remove(); // Remove any unnecessary paths
    }

    updatePaths(pcpData); // Initial path rendering

    // Define D3 axis generator
    const axis = d3.axisLeft();

    // Append axis elements for each dimension
    const dimension = svg.selectAll(".dimension")
        .data(dimensions)
        .enter().append("g")
        .attr("class", "dimension")
        .attr("transform", d => `translate(${x(d)})`)
        .call(d3.drag() // Add drag functionality to move dimensions
            .on("start", dragStarted)
            .on("drag", dragged)
            .on("end", dragEnded));

    // Function to handle drag start event
    function dragStarted(event) {
        type=event.sourceEvent.srcElement.tagName

        if (type=="text" || type=="DIV") {
            event.sourceEvent.stopPropagation();
            this.__origin__ = { x: event.x };
            this.__crossed = false; // Initialize crossed flag
        }
    }

    // Function to handle dragging event
    function dragged(event, d) {

        type=event.sourceEvent.srcElement.tagName

        if (type=="text" || type=="DIV") {

            const dx = event.x - this.__origin__.x; // Calculate the change in x
            const currentX = x(d) + dx;

            // Update axis position
            d3.select(this).attr("transform", `translate(${currentX})`);

            // Check for axis crossing and swap if necessary
            const currentIndex = dimensions.indexOf(d);
            const nextIndex = findNextAxisIndex(currentIndex, currentX);
            if (nextIndex !== -1 && nextIndex !== currentIndex) {
                // Swap axes
                const nextDimension = dimensions[nextIndex];
                dimensions[currentIndex] = nextDimension;
                dimensions[nextIndex] = d;
                x.domain(dimensions);
                svg.selectAll(".dimension")
                    .attr("transform", dimension => `translate(${x(dimension)})`);

                this.__origin__.x = event.x; // Reset origin to current position
                this.__crossed = true; // Set crossed flag
            }

            // If crossed, restart the dragging process
            if (this.__crossed) {
                this.__origin__.x = event.x;
                this.__crossed = false;
            }

            // Update path lines
            svg.selectAll("path").attr("d", function (pathData) {
                return drawPath(pathData, d, currentX);
            });
        }

    }

    // Function to handle drag end event
    function dragEnded(event) {
        event.sourceEvent.stopPropagation();
    }

    // Draw axes and labels
    dimension.append("g")
        .attr("class", "axis")
        .each(function (d) { d3.select(this).call(axis.scale(y[d])); })
        .append("text")
        .style("text-anchor", "middle")
        .attr("y", -9)
        .text(d => d)
        .style("cursor", "crosshair")
        .style("font-size", "10px"); // Increase the font size here

    // Add brush functionality to filter dimensions
    dimension.append("g")
        .attr("class", "brush")
        .each(function(d) {
            d3.select(this).call(d3.brushY()
                .extent([[-8, 0], [8, height]])
                .on("start", brushstart)
                .on("brush", brush)
                .on("end", brushend));
    });

    // Function to handle brush start event
    function brushstart() {
        d3.event.sourceEvent.stopPropagation();
    }

    // Function to handle brush event
    function brush() {
        const actives = [];
        svg.selectAll(".brush")
            .filter(function(d) {
                return d3.brushSelection(this);
            })
            .each(function(d) {
                actives.push({
                    dimension: d,
                    extent: d3.brushSelection(this).map(y[d].invert)
                });
            });

        svg.selectAll("path").style("display", function(d) {
            return actives.every(function(active) {
                const dim = active.dimension;
                const extent = active.extent;
                return extent[1] <= d[dim] && d[dim] <= extent[0];
            }) ? null : "none";
        });
    }

    // Function to handle brush end event
    function brushend() {
        d3.event.sourceEvent.stopPropagation();
    }

    // Function to draw path lines
    function drawPath(d, draggedDimension, currentX) {
        return d3.line()(dimensions.map(p => {
            if (p === draggedDimension) {
                // If this is the dragged dimension, adjust its x position
                return [currentX, y[p](d[p])];
            } else {
                return [x(p), y[p](d[p])];
            }
        }));
    }

    // Function to find the next axis index
    function findNextAxisIndex(currentIndex, currentX) {
        let nextIndex = -1;
        if (currentIndex > 0 && currentX < x(dimensions[currentIndex - 1])) {
            nextIndex = currentIndex - 1;
        } else if (currentIndex < dimensions.length - 1 && currentX > x(dimensions[currentIndex + 1])) {
            nextIndex = currentIndex + 1;
        }
        return nextIndex;
    }
}




function drawWordCloud() {
    
    const topArtistsData = JSON.parse(main_response.top_artists);

    // Extract counts from topArtistsData
    const counts = topArtistsData.map(d => d.count);

    // Calculate min and max counts
    const minCount = Math.min(...counts);
    const maxCount = Math.max(...counts);

    // Convert counts to array of objects for word cloud data
    const wordCloudData = topArtistsData.map(d => ({
        text: d.artist,
        size: d.count  // Use count directly as the size
    }));

    // Set up the font size scale based on min and max counts
    const fontSizeScale = d3.scaleLinear()
        .domain([minCount, maxCount])
        .range([13, 40]);  // Set the range of font sizes you want

    Math.seedrandom('your_seed_here');

    // Set up the word cloud layout
    const layout = d3.layout.cloud()
        .size([470, 288])  // Set the size of the word cloud area
        .words(wordCloudData)
        .padding(5)
        .rotate(() => ~~(Math.random() * 2) * 90)
        .fontSize(d => fontSizeScale(d.size))
        .on("end", draw);

    // Generate the word cloud
    layout.start();

    // Function to draw the word cloud
    function draw(words) {
        d3.select("#word-cloud").select("svg").remove();  // Remove existing SVG
        const svg = d3.select("#word-cloud").append("svg")
            .attr("width", layout.size()[0])
            .attr("height", layout.size()[1])
            .append("g")
            .attr("transform", "translate(" + layout.size()[0] / 2 + "," + layout.size()[1] / 2 + ")");

        svg.selectAll("text")
            .data(words)
            .enter().append("text")
            .style("font-size", d => d.size + "px")
            .style("fill", (d, i) => d3.schemeCategory10[i % 10])  // Use color scheme for text
            .attr("text-anchor", "middle")
            .attr("transform", d => "translate(" + [d.x, d.y] + ")rotate(" + d.rotate + ")")
            .text(d => d.text);

            // Add title to the word cloud
        svg.append("text")
            .attr("x", 0) // Position at the center of the SVG
            .attr("y", -125) // Position above the word cloud
            .attr("text-anchor", "middle")
            .attr("font-size", "20px") // Set the font size for the title
            .attr("font-weight", "bold") // Optional: make the title bold
            .text("Top Artists"); // Title text
}
}

