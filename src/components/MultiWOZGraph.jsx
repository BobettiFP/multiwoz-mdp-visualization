import React, { useState, useEffect, useRef } from 'react';
import * as d3 from 'd3';
import './MultiWOZGraph.css';

const MultiWOZGraph = () => {
  const [graphData, setGraphData] = useState(null);
  const [domain, setDomain] = useState('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const svgRef = useRef(null);
  
  // 데이터 불러오기
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        // Flask 백엔드 API에서 데이터 가져오기
        const response = await fetch(`http://localhost:5000/api/graph/${domain}`);
        
        if (!response.ok) {
          throw new Error(`HTTP error! Status: ${response.status}`);
        }
        
        const data = await response.json();
        setGraphData(data);
        setError(null);
      } catch (err) {
        console.error("Error fetching graph data:", err);
        setError(`데이터 로딩 오류: ${err.message}`);
        
        // 개발 테스트용: 백엔드 연결 안 될 경우 더미 데이터 사용
        setGraphData(generateDummyData());
      } finally {
        setLoading(false);
      }
    };
    
    fetchData();
  }, [domain]);
  
  // 그래프 렌더링
  useEffect(() => {
    if (!graphData || !svgRef.current) return;
    
    const width = 900;
    const height = 700;
    
    // SVG 초기화
    const svg = d3.select(svgRef.current)
      .attr('width', width)
      .attr('height', height)
      .attr('viewBox', [0, 0, width, height])
      .attr('style', 'max-width: 100%; height: auto;');
    
    svg.selectAll("*").remove();
    
    // 줌 기능 추가
    const zoom = d3.zoom()
      .scaleExtent([0.1, 4])
      .on("zoom", (event) => {
        g.attr("transform", event.transform);
      });
    
    svg.call(zoom);
    
    // 메인 그래프 그룹
    const g = svg.append("g");
    
    // 노드 데이터 처리
    const nodes = graphData.nodes.map(node => ({...node}));
    
    // 링크 데이터 처리 (문자열 ID를 객체 참조로 변환)
    const nodeById = new Map(nodes.map(node => [node.id, node]));
    const links = graphData.links.map(link => ({
      source: typeof link.source === 'string' ? link.source : link.source.id,
      target: typeof link.target === 'string' ? link.target : link.target.id
    }));
    
    // 시뮬레이션 설정
    const simulation = d3.forceSimulation(nodes)
      .force('link', d3.forceLink(links).id(d => d.id).distance(120))
      .force('charge', d3.forceManyBody().strength(-500))
      .force('center', d3.forceCenter(width / 2, height / 2))
      .force('collision', d3.forceCollide().radius(60));
    
    // 화살표 정의
    g.append('defs').selectAll('marker')
      .data(['end'])
      .join('marker')
      .attr('id', 'arrow')
      .attr('viewBox', '0 -5 10 10')
      .attr('refX', 30)
      .attr('refY', 0)
      .attr('markerWidth', 6)
      .attr('markerHeight', 6)
      .attr('orient', 'auto')
      .append('path')
      .attr('d', 'M0,-5L10,0L0,5')
      .attr('fill', '#999');
    
    // 링크(엣지) 그리기
    const link = g.append('g')
      .attr('class', 'links')
      .selectAll('line')
      .data(links)
      .join('line')
      .attr('stroke', '#999')
      .attr('stroke-opacity', 0.6)
      .attr('stroke-width', 1.5)
      .attr('marker-end', 'url(#arrow)');
    
    // 노드 그룹 생성
    const node = g.append('g')
      .attr('class', 'nodes')
      .selectAll('.node')
      .data(nodes)
      .join('g')
      .attr('class', 'node')
      .call(d3.drag()
        .on('start', dragstarted)
        .on('drag', dragged)
        .on('end', dragended));
    
    // 노드 모양 그리기 (상태는 사각형, 행동은 원형/타원형)
    node.append('rect')
      .attr('x', d => d.type === 'state' ? -55 : -65)
      .attr('y', -20)
      .attr('width', d => d.type === 'state' ? 110 : 130)
      .attr('height', 40)
      .attr('rx', d => d.type === 'state' ? 5 : 20)
      .attr('ry', d => d.type === 'state' ? 5 : 20)
      .attr('fill', d => d.color || (d.type === 'state' ? 'lightblue' : 'lightgray'))
      .attr('stroke', '#666')
      .attr('stroke-width', 1.5);
    
    // 노드 라벨 추가
    node.append('text')
      .attr('text-anchor', 'middle')
      .attr('dy', 5)
      .attr('font-size', '12px')
      .text(d => d.label || d.id)
      .call(wrap, 100);  // 긴 텍스트 래핑
    
    // 툴팁 추가
    node.append('title')
      .text(d => `${d.id}\nType: ${d.type}${d.domain ? `\nDomain: ${d.domain}` : ''}`);
    
    // 시뮬레이션 이벤트 핸들러
    simulation.on('tick', () => {
      link
        .attr('x1', d => d.source.x)
        .attr('y1', d => d.source.y)
        .attr('x2', d => d.target.x)
        .attr('y2', d => d.target.y);
      
      node.attr('transform', d => `translate(${d.x},${d.y})`);
    });
    
    // 드래그 이벤트 핸들러
    function dragstarted(event, d) {
      if (!event.active) simulation.alphaTarget(0.3).restart();
      d.fx = d.x;
      d.fy = d.y;
    }
    
    function dragged(event, d) {
      d.fx = event.x;
      d.fy = event.y;
    }
    
    function dragended(event, d) {
      if (!event.active) simulation.alphaTarget(0);
      d.fx = null;
      d.fy = null;
    }
    
    // 텍스트 래핑 함수
    function wrap(text, width) {
      text.each(function() {
        const text = d3.select(this);
        const words = text.text().split(/\s+/).reverse();
        let word;
        let line = [];
        let lineNumber = 0;
        const lineHeight = 1.1;
        const y = text.attr("y");
        const dy = parseFloat(text.attr("dy"));
        let tspan = text.text(null).append("tspan").attr("x", 0).attr("y", y).attr("dy", dy + "em");
        
        while (word = words.pop()) {
          line.push(word);
          tspan.text(line.join(" "));
          if (tspan.node().getComputedTextLength() > width) {
            line.pop();
            tspan.text(line.join(" "));
            line = [word];
            tspan = text.append("tspan").attr("x", 0).attr("y", y).attr("dy", ++lineNumber * lineHeight + dy + "em").text(word);
          }
        }
      });
    }
    
  }, [graphData]);
  
  // 개발 테스트용 더미 데이터 생성 함수
  const generateDummyData = () => {
    const domains = ['hotel', 'restaurant', 'train'];
    const nodes = [
      { id: 'start', label: 'Start', type: 'state', color: 'green' },
      { id: 'end', label: 'End', type: 'state', color: 'red' },
      { id: 'greeting', label: 'Greeting', type: 'action', color: 'lightgray' },
      { id: 'goodbye', label: 'Goodbye', type: 'action', color: 'lightgray' }
    ];
    
    const links = [
      { source: 'start', target: 'greeting' },
      { source: 'end', target: 'goodbye' }
    ];
    
    // 기본 도메인 그래프 생성
    domains.forEach(domain => {
      // 상태 노드 추가
      nodes.push({ id: `${domain}_selected`, label: `${domain} Selected`, type: 'state', color: 'lightblue', domain });
      nodes.push({ id: `${domain}_booking`, label: `${domain} Booking`, type: 'state', color: 'lightblue', domain });
      nodes.push({ id: `${domain}_booked`, label: `${domain} Booked`, type: 'state', color: 'lightgreen', domain });
      
      // 행동 노드 추가
      nodes.push({ id: `${domain}-request`, label: `${domain} Request`, type: 'action', color: 'yellow', domain });
      nodes.push({ id: `${domain}-inform`, label: `${domain} Inform`, type: 'action', color: 'lightpink', domain });
      nodes.push({ id: `${domain}-book`, label: `${domain} Book`, type: 'action', color: 'purple', domain });
      
      // 링크 추가
      links.push({ source: 'greeting', target: `${domain}_selected` });
      links.push({ source: `${domain}_selected`, target: `${domain}-request` });
      links.push({ source: `${domain}-request`, target: `${domain}-inform` });
      links.push({ source: `${domain}-inform`, target: `${domain}_booking` });
      links.push({ source: `${domain}_booking`, target: `${domain}-book` });
      links.push({ source: `${domain}-book`, target: `${domain}_booked` });
      links.push({ source: `${domain}_booked`, target: 'end' });
    });
    
    return { nodes, links };
  };
  
  return (
    <div className="multiwoz-graph-container">
      <div className="controls">
        <h2>MultiWOZ 상태-행동 공간</h2>
        <div className="domain-selector">
          <label htmlFor="domain-select">도메인 선택:</label>
          <select 
            id="domain-select" 
            value={domain} 
            onChange={(e) => setDomain(e.target.value)}
            disabled={loading}
          >
            <option value="all">전체 도메인</option>
            <option value="hotel">Hotel</option>
            <option value="restaurant">Restaurant</option>
            <option value="train">Train</option>
          </select>
        </div>
        
        <div className="legend">
          <h3>범례</h3>
          <div className="legend-item">
            <span className="legend-color" style={{backgroundColor: 'green'}}></span>
            <span>시작 상태</span>
          </div>
          <div className="legend-item">
            <span className="legend-color" style={{backgroundColor: 'red'}}></span>
            <span>종료 상태</span>
          </div>
          <div className="legend-item">
            <span className="legend-color" style={{backgroundColor: 'lightblue'}}></span>
            <span>일반 상태</span>
          </div>
          <div className="legend-item">
            <span className="legend-color" style={{backgroundColor: 'orange'}}></span>
            <span>결과 없음 상태</span>
          </div>
          <div className="legend-item">
            <span className="legend-color" style={{backgroundColor: 'lightgreen'}}></span>
            <span>예약 완료 상태</span>
          </div>
          <div className="legend-item">
            <span className="legend-color" style={{backgroundColor: 'yellow'}}></span>
            <span>요청 행동</span>
          </div>
          <div className="legend-item">
            <span className="legend-color" style={{backgroundColor: 'lightpink'}}></span>
            <span>정보 제공/추천 행동</span>
          </div>
          <div className="legend-item">
            <span className="legend-color" style={{backgroundColor: 'purple'}}></span>
            <span>예약 행동</span>
          </div>
        </div>
        
        <div className="instructions">
          <p>드래그하여 노드 이동, 휠로 확대/축소, 노드 위에 마우스를 올려 상세 정보 확인</p>
        </div>
      </div>
      
      <div className="graph-container">
        {loading && <div className="loading">로딩 중...</div>}
        {error && <div className="error">{error}</div>}
        <svg ref={svgRef} className="graph"></svg>
      </div>
    </div>
  );
};

export default MultiWOZGraph;